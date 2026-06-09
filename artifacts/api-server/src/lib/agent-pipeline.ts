import { db } from "@workspace/db";
import { ticketsTable, agentRunsTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "./gemini";
import { sendSlackAlert } from "./slack";
import type { Logger } from "pino";

type Ticket = typeof ticketsTable.$inferSelect;

const AGENTS = [
  {
    name: "TicketReader",
    label: "Reading & Classifying Ticket",
    prompt: (t: Ticket) =>
      `You are TicketReader, an AI agent for a customer support team. Analyze this support ticket and return a JSON object with: category (billing/technical/shipping/returns/general), summary (2 sentences max summarizing the issue), and urgency_notes (any urgency indicators).\n\nTicket Subject: ${t.subject}\nTicket Body: ${t.body}\nCustomer: ${t.customerName}\n\nRespond ONLY with valid JSON.`,
  },
  {
    name: "PolicyResearcher",
    label: "Researching Policies",
    prompt: (t: Ticket) =>
      `You are PolicyResearcher, a customer support policy expert. Based on this support ticket, identify the relevant company policies that apply and provide guidance notes. Return JSON with: applicable_policies (array of policy names), policy_notes (2-3 sentences of relevant policy guidance for this case).\n\nTicket Subject: ${t.subject}\nTicket Body: ${t.body}\n\nRespond ONLY with valid JSON.`,
  },
  {
    name: "ResponseDrafter",
    label: "Drafting Response",
    prompt: (t: Ticket) =>
      `You are ResponseDrafter, a customer support specialist. Write a professional, empathetic response to this customer support ticket. Be concise (3-5 sentences), helpful, and solution-oriented. Return JSON with: draft_response (the full response text ready to send).\n\nTicket Subject: ${t.subject}\nTicket Body: ${t.body}\nCustomer Name: ${t.customerName}\n\nRespond ONLY with valid JSON.`,
  },
  {
    name: "EscalationDetector",
    label: "Detecting Escalation Risk",
    prompt: (t: Ticket) =>
      `You are EscalationDetector, an AI agent that assesses customer support escalation risk. Analyze this ticket and return JSON with: escalation_risk (low/medium/high), escalation_reason (one sentence explaining the risk level), should_escalate (boolean).\n\nTicket Subject: ${t.subject}\nTicket Body: ${t.body}\nCustomer: ${t.customerName}\n\nRespond ONLY with valid JSON.`,
  },
];

export async function runAgentPipeline(ticket: Ticket, logger?: Logger): Promise<void> {
  // Guard: skip if already processed
  if (ticket.processedAt) return;

  const updates: Record<string, unknown> = {};

  for (const agent of AGENTS) {
    const start = Date.now();
    try {
      const [run] = await db
        .insert(agentRunsTable)
        .values({ ticketId: ticket.id, agentName: agent.name, status: "running" })
        .returning();

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: agent.prompt(ticket) }] }],
        config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
      });

      const text = response.text ?? "{}";
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(text); } catch { parsed = {}; }

      const durationMs = Date.now() - start;

      await db
        .update(agentRunsTable)
        .set({ status: "success", output: text, durationMs })
        .where(eq(agentRunsTable.id, run.id));

      if (agent.name === "TicketReader") {
        updates.category = parsed.category as string;
        updates.agentSummary = parsed.summary as string;
      } else if (agent.name === "PolicyResearcher") {
        updates.policyNotes = parsed.policy_notes as string;
      } else if (agent.name === "ResponseDrafter") {
        updates.draftResponse = parsed.draft_response as string;
      } else if (agent.name === "EscalationDetector") {
        updates.escalationRisk = parsed.escalation_risk as string;
        updates.escalationReason = parsed.escalation_reason as string;
      }
    } catch (err) {
      logger?.error({ err }, `Auto-triage agent ${agent.name} failed for ticket ${ticket.id}`);
    }
  }

  const [updated] = await db
    .update(ticketsTable)
    .set({ ...updates, status: "in_progress", processedAt: new Date(), updatedAt: new Date() })
    .where(eq(ticketsTable.id, ticket.id))
    .returning();

  // Fire Slack alert if configured
  try {
    const settingsRows = await db.select().from(settingsTable).limit(1);
    const settings = settingsRows[0];
    if (settings?.alertsEnabled && settings.slackWebhookUrl) {
      const risk = (updates.escalationRisk as string | undefined) ?? "";
      const shouldAlert =
        (risk === "high" && settings.alertOnHigh) ||
        (risk === "medium" && settings.alertOnMedium);
      if (shouldAlert) {
        await sendSlackAlert(settings.slackWebhookUrl, {
          id: updated.id,
          subject: updated.subject,
          customerName: updated.customerName,
          customerEmail: updated.customerEmail,
          priority: updated.priority,
          escalationRisk: updated.escalationRisk,
          escalationReason: updated.escalationReason,
        });
      }
    }
  } catch (err) {
    logger?.error({ err }, `Auto-triage Slack alert failed for ticket ${ticket.id}`);
  }

  logger?.info({ ticketId: ticket.id }, "Auto-triage complete");
}
