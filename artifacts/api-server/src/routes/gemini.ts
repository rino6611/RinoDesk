import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages, ticketsTable, agentRunsTable } from "@workspace/db";
import { eq, asc, inArray } from "drizzle-orm";
import { ai } from "../lib/gemini";
import {
  CreateGeminiConversationBody,
  GetGeminiConversationParams,
  DeleteGeminiConversationParams,
  ListGeminiMessagesParams,
  SendGeminiMessageParams,
  SendGeminiMessageBody,
} from "@workspace/api-zod";

/** Extract all ticket IDs mentioned in a message, e.g. #9, ticket 9, ticket #12 */
function extractTicketIds(text: string): number[] {
  const patterns = [
    /#(\d+)/g,
    /ticket\s*#?(\d+)/gi,
  ];
  const ids = new Set<number>();
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      ids.add(Number(m[1]));
    }
  }
  return [...ids];
}

/** Build a context block for a set of ticket IDs to inject into the system prompt */
async function buildTicketContext(ids: number[]): Promise<string> {
  if (ids.length === 0) return "";

  const tickets = await db
    .select()
    .from(ticketsTable)
    .where(inArray(ticketsTable.id, ids));

  if (tickets.length === 0) return `\nNote: Ticket(s) #${ids.join(", #")} were not found in the database.\n`;

  const agentRuns = await db
    .select()
    .from(agentRunsTable)
    .where(inArray(agentRunsTable.ticketId, ids));

  const runsByTicket = new Map<number, typeof agentRuns>();
  for (const run of agentRuns) {
    if (!runsByTicket.has(run.ticketId)) runsByTicket.set(run.ticketId, []);
    runsByTicket.get(run.ticketId)!.push(run);
  }

  const blocks = tickets.map((t) => {
    const runs = runsByTicket.get(t.id) ?? [];
    const agentOutputs = runs
      .filter((r) => r.output && r.status === "success")
      .map((r) => {
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(r.output!); } catch { /* ignore */ }
        return `  [${r.agentName}]: ${JSON.stringify(parsed)}`;
      })
      .join("\n");

    return [
      `--- TICKET #${t.id} ---`,
      `Subject: ${t.subject}`,
      `Customer: ${t.customerName} <${t.customerEmail}>`,
      `Status: ${t.status} | Priority: ${t.priority} | Category: ${t.category ?? "uncategorized"}`,
      `Escalation Risk: ${t.escalationRisk ?? "not assessed"}`,
      `Body:\n${t.body}`,
      t.agentSummary ? `AI Summary: ${t.agentSummary}` : "",
      t.draftResponse ? `Draft Response: ${t.draftResponse}` : "",
      t.policyNotes ? `Policy Notes: ${t.policyNotes}` : "",
      t.escalationReason ? `Escalation Reason: ${t.escalationReason}` : "",
      agentOutputs ? `Full Agent Outputs:\n${agentOutputs}` : "",
    ].filter(Boolean).join("\n");
  });

  return `\n\nLIVE TICKET DATA FROM DATABASE:\n${blocks.join("\n\n")}\n`;
}

const router = Router();

router.get("/gemini/conversations", async (req, res) => {
  try {
    const all = await db.select().from(conversations);
    res.json(all);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/gemini/conversations", async (req, res) => {
  try {
    const body = CreateGeminiConversationBody.parse(req.body);
    const [conv] = await db.insert(conversations).values({ title: body.title }).returning();
    res.status(201).json(conv);
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(400).json({ error: "Invalid input" });
  }
});

router.get("/gemini/conversations/:id", async (req, res) => {
  try {
    GetGeminiConversationParams.parse(req.params);
    const id = Number(req.params.id);
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
    res.json({ ...conv, messages: msgs });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/gemini/conversations/:id", async (req, res) => {
  try {
    DeleteGeminiConversationParams.parse(req.params);
    const id = Number(req.params.id);
    await db.delete(messages).where(eq(messages.conversationId, id));
    const deleted = await db.delete(conversations).where(eq(conversations.id, id)).returning();
    if (!deleted.length) { res.status(404).json({ error: "Conversation not found" }); return; }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/gemini/conversations/:id/messages", async (req, res) => {
  try {
    ListGeminiMessagesParams.parse(req.params);
    const id = Number(req.params.id);
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
    res.json(msgs);
  } catch (err) {
    req.log.error({ err }, "Failed to list messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/gemini/conversations/:id/messages", async (req, res) => {
  try {
    SendGeminiMessageParams.parse(req.params);
    const body = SendGeminiMessageBody.parse(req.body);
    const id = Number(req.params.id);

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

    await db.insert(messages).values({ conversationId: id, role: "user", content: body.content });

    const history = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    // Auto-fetch any tickets mentioned in the latest user message
    const ticketIds = extractTicketIds(body.content);
    const ticketContext = await buildTicketContext(ticketIds);

    const systemInstruction = [
      "You are a helpful AI assistant for a customer support team using RinoDesk AgentOS.",
      "You have DIRECT ACCESS to the live ticket database. When a user mentions a ticket number (e.g. #9, ticket 12), the system automatically fetches its full data and provides it to you — you can see the customer name, issue, priority, AI agent outputs, draft responses, escalation risk, and policy notes.",
      "Use this data to give specific, accurate answers. Never say you cannot access tickets — you always receive their data automatically.",
      "Help agents draft responses, understand policies, analyse patterns, and handle escalations. Be concise, practical, and supportive.",
      ticketContext,
    ].filter(Boolean).join("\n\n");

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      config: { maxOutputTokens: 8192, systemInstruction },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(messages).values({ conversationId: id, role: "assistant", content: fullResponse });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
