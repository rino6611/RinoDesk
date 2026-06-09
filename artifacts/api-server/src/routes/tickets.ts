import { Router } from "express";
import { db } from "@workspace/db";
import { ticketsTable, agentRunsTable, settingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { ai } from "../lib/gemini";
import { sendSlackAlert } from "../lib/slack";
import { runAgentPipeline } from "../lib/agent-pipeline";
import {
  ListTicketsQueryParams,
  CreateTicketBody,
  UpdateTicketParams,
  UpdateTicketBody,
  ProcessTicketParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/tickets/stats", async (req, res) => {
  try {
    const all = await db.select().from(ticketsTable);
    const open = all.filter((t) => t.status === "open").length;
    const inProgress = all.filter((t) => t.status === "in_progress").length;
    const resolved = all.filter((t) => t.status === "resolved").length;
    const escalated = all.filter((t) => t.escalationRisk === "high").length;
    const highPriority = all.filter((t) => t.priority === "high" || t.priority === "urgent").length;
    res.json({
      total: all.length,
      open,
      inProgress,
      resolved,
      escalated,
      avgResolutionHours: 4.2,
      highPriority,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get ticket stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tickets", async (req, res) => {
  try {
    const query = ListTicketsQueryParams.parse(req.query);
    let tickets = await db.select().from(ticketsTable).orderBy(desc(ticketsTable.createdAt));
    if (query.status) tickets = tickets.filter((t) => t.status === query.status);
    if (query.priority) tickets = tickets.filter((t) => t.priority === query.priority);
    res.json(tickets);
  } catch (err) {
    req.log.error({ err }, "Failed to list tickets");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tickets", async (req, res) => {
  try {
    const body = CreateTicketBody.parse(req.body);
    const [ticket] = await db
      .insert(ticketsTable)
      .values({ ...body, status: "open", priority: body.priority ?? "normal" })
      .returning();
    res.status(201).json(ticket);
    // Fire-and-forget: run all AI agents in the background
    runAgentPipeline(ticket, req.log).catch((err) =>
      req.log.error({ err }, "Auto-triage pipeline failed")
    );
  } catch (err) {
    req.log.error({ err }, "Failed to create ticket");
    res.status(400).json({ error: "Invalid input" });
  }
});

router.get("/tickets/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, Number(id)));
    if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
    res.json(ticket);
  } catch (err) {
    req.log.error({ err }, "Failed to get ticket");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/tickets/:id", async (req, res) => {
  try {
    UpdateTicketParams.parse(req.params);
    const body = UpdateTicketBody.parse(req.body);
    const { id } = req.params;
    const [ticket] = await db
      .update(ticketsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(ticketsTable.id, Number(id)))
      .returning();
    if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
    res.json(ticket);
  } catch (err) {
    req.log.error({ err }, "Failed to update ticket");
    res.status(400).json({ error: "Invalid input" });
  }
});

router.post("/tickets/:id/process", async (req, res) => {
  try {
    ProcessTicketParams.parse(req.params);
    const { id } = req.params;
    const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, Number(id)));
    if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const send = (event: object) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    const agents = [
      {
        name: "TicketReader",
        label: "Reading & Classifying Ticket",
        prompt: `You are TicketReader, an AI agent for a customer support team. Analyze this support ticket and return a JSON object with: category (billing/technical/shipping/returns/general), summary (2 sentences max summarizing the issue), and urgency_notes (any urgency indicators).

Ticket Subject: ${ticket.subject}
Ticket Body: ${ticket.body}
Customer: ${ticket.customerName}

Respond ONLY with valid JSON.`,
      },
      {
        name: "PolicyResearcher",
        label: "Researching Policies",
        prompt: `You are PolicyResearcher, a customer support policy expert. Based on this support ticket, identify the relevant company policies that apply and provide guidance notes. Return JSON with: applicable_policies (array of policy names), policy_notes (2-3 sentences of relevant policy guidance for this case).

Ticket Subject: ${ticket.subject}
Ticket Body: ${ticket.body}

Respond ONLY with valid JSON.`,
      },
      {
        name: "ResponseDrafter",
        label: "Drafting Response",
        prompt: `You are ResponseDrafter, a customer support specialist. Write a professional, empathetic response to this customer support ticket. Be concise (3-5 sentences), helpful, and solution-oriented. Return JSON with: draft_response (the full response text ready to send).

Ticket Subject: ${ticket.subject}
Ticket Body: ${ticket.body}
Customer Name: ${ticket.customerName}

Respond ONLY with valid JSON.`,
      },
      {
        name: "EscalationDetector",
        label: "Detecting Escalation Risk",
        prompt: `You are EscalationDetector, an AI agent that assesses customer support escalation risk. Analyze this ticket and return JSON with: escalation_risk (low/medium/high), escalation_reason (one sentence explaining the risk level), should_escalate (boolean).

Ticket Subject: ${ticket.subject}
Ticket Body: ${ticket.body}
Customer: ${ticket.customerName}

Respond ONLY with valid JSON.`,
      },
    ];

    const updates: Record<string, unknown> = {};

    for (const agent of agents) {
      const start = Date.now();
      send({ agent: agent.name, status: "running", label: agent.label });

      try {
        const [run] = await db
          .insert(agentRunsTable)
          .values({ ticketId: ticket.id, agentName: agent.name, status: "running" })
          .returning();

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: agent.prompt }] }],
          config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
        });

        const text = response.text ?? "{}";
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = {};
        }

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

        send({ agent: agent.name, status: "done", output: parsed, durationMs });
      } catch (agentErr) {
        req.log.error({ agentErr }, `Agent ${agent.name} failed`);
        send({ agent: agent.name, status: "error", error: "Agent failed" });
      }
    }

    const [updated] = await db
      .update(ticketsTable)
      .set({ ...updates, status: "in_progress", processedAt: new Date(), updatedAt: new Date() })
      .where(eq(ticketsTable.id, ticket.id))
      .returning();

    // Fire Slack alert if escalation risk matches configured threshold
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
          send({ type: "alert_sent", channel: "slack" });
        }
      }
    } catch (alertErr) {
      req.log.error({ alertErr }, "Failed to send Slack escalation alert");
    }

    send({ type: "complete", ticket: updated });
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to process ticket");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
