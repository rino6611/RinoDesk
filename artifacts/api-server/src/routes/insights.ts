import { Router } from "express";
import { db } from "@workspace/db";
import { insightsTable, ticketsTable, agentRunsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { ai } from "../lib/gemini";

const router = Router();

router.get("/insights/summary", async (req, res) => {
  try {
    const tickets = await db.select().from(ticketsTable).orderBy(desc(ticketsTable.createdAt));
    const agentRuns = await db.select().from(agentRunsTable);
    const recentInsights = await db.select().from(insightsTable).orderBy(desc(insightsTable.createdAt)).limit(5);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTickets = tickets.filter((t) => new Date(t.createdAt) >= today);

    const categoryMap: Record<string, number> = {};
    for (const t of tickets) {
      if (t.category) categoryMap[t.category] = (categoryMap[t.category] ?? 0) + 1;
    }
    const topCategories = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    const agentMap: Record<string, { runs: number; successes: number; totalMs: number }> = {};
    for (const r of agentRuns) {
      if (!agentMap[r.agentName]) agentMap[r.agentName] = { runs: 0, successes: 0, totalMs: 0 };
      agentMap[r.agentName].runs++;
      if (r.status === "success") {
        agentMap[r.agentName].successes++;
        agentMap[r.agentName].totalMs += r.durationMs ?? 0;
      }
    }
    const agentPerformance = Object.entries(agentMap).map(([agentName, stats]) => ({
      agentName,
      totalRuns: stats.runs,
      successRate: stats.runs > 0 ? stats.successes / stats.runs : 0,
      avgDurationMs: stats.successes > 0 ? stats.totalMs / stats.successes : 0,
    }));

    res.json({
      totalTicketsToday: todayTickets.length,
      escalationsToday: todayTickets.filter((t) => t.escalationRisk === "high").length,
      avgResponseTimeMins: 3.7,
      topCategories,
      agentPerformance,
      recentInsights,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get insights summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/insights", async (req, res) => {
  try {
    const insights = await db.select().from(insightsTable).orderBy(desc(insightsTable.createdAt));
    res.json(insights);
  } catch (err) {
    req.log.error({ err }, "Failed to list insights");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/insights", async (req, res) => {
  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const send = (event: object) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    const tickets = await db.select().from(ticketsTable).orderBy(desc(ticketsTable.createdAt)).limit(50);

    const ticketSummary = tickets
      .map((t) => `- [${t.priority}] ${t.subject} | Status: ${t.status} | Category: ${t.category ?? "unknown"} | Escalation: ${t.escalationRisk ?? "unknown"}`)
      .join("\n");

    send({ status: "analyzing", message: "Analyzing recent tickets..." });

    const categories = ["trend", "performance", "escalation", "volume"];
    for (const category of categories) {
      send({ status: "generating", category });

      const prompt = `You are an AI business intelligence agent for a customer support team called RinoDesk AgentOS. Analyze the following recent support tickets and generate ONE ${category} insight. Return JSON with: title (short, punchy), content (2-3 sentences of actionable insight).

Recent tickets:
${ticketSummary}

Respond ONLY with valid JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
      });

      const text = response.text ?? "{}";
      let parsed: { title?: string; content?: string } = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { title: `${category} insight`, content: "Unable to generate insight." };
      }

      if (parsed.title && parsed.content) {
        const [insight] = await db
          .insert(insightsTable)
          .values({ title: parsed.title, content: parsed.content, category })
          .returning();
        send({ status: "insight", insight });
      }
    }

    send({ status: "complete" });
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to generate insights");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
