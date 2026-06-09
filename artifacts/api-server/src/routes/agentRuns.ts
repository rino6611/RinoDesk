import { Router } from "express";
import { db } from "@workspace/db";
import { agentRunsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { ListAgentRunsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/agents/runs", async (req, res) => {
  try {
    const query = ListAgentRunsQueryParams.parse(req.query);
    let runs = await db.select().from(agentRunsTable).orderBy(desc(agentRunsTable.createdAt)).limit(100);
    if (query.ticketId) runs = runs.filter((r) => r.ticketId === query.ticketId);
    if (query.agentName) runs = runs.filter((r) => r.agentName === query.agentName);
    res.json(runs);
  } catch (err) {
    req.log.error({ err }, "Failed to list agent runs");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
