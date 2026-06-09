import { Router } from "express";
import { db, ticketsTable, usersTable, resolutionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

// Resolve a ticket AND log it to the tracker (agent = current user)
router.post("/tickets/:id/resolve", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id)).limit(1);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    let agentName = "Unknown";
    const userId = req.session.userId;
    if (userId) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (u) agentName = u.name;
    }

    const [updated] = await db
      .update(ticketsTable)
      .set({ status: "resolved", updatedAt: new Date() })
      .where(eq(ticketsTable.id, id))
      .returning();

    await db.insert(resolutionsTable).values({
      ticketId: ticket.id,
      agentName,
      customerName: ticket.customerName,
      customerEmail: ticket.customerEmail,
      issue: ticket.agentSummary || ticket.subject,
      resolution: ticket.draftResponse || "Resolved",
    });

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to resolve ticket");
    res.status(500).json({ error: "Internal server error" });
  }
});

// List all logged resolutions (newest first)
router.get("/resolutions", async (req, res) => {
  try {
    const rows = await db.select().from(resolutionsTable).orderBy(desc(resolutionsTable.resolvedAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list resolutions");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
