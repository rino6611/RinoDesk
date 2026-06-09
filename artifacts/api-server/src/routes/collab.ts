import { Router } from "express";
import { db, usersTable, ticketsTable, ticketNotesTable, kbArticlesTable } from "@workspace/db";
import { eq, desc, asc } from "drizzle-orm";
import { ai } from "../lib/gemini";

const router = Router();

router.get("/users", async (req, res) => {
  try {
    const rows = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, picture: usersTable.picture })
      .from(usersTable)
      .orderBy(asc(usersTable.name));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list users");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/tickets/:id/assign", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const assigneeId =
      req.body?.assigneeId === null || req.body?.assigneeId === undefined ? null : Number(req.body.assigneeId);
    const [ticket] = await db
      .update(ticketsTable)
      .set({ assigneeId, updatedAt: new Date() })
      .where(eq(ticketsTable.id, id))
      .returning();
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    res.json(ticket);
  } catch (err) {
    req.log.error({ err }, "Failed to assign ticket");
    res.status(400).json({ error: "Invalid input" });
  }
});

router.get("/tickets/:id/notes", async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const rows = await db.select().from(ticketNotesTable).where(eq(ticketNotesTable.ticketId, ticketId)).orderBy(desc(ticketNotesTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list notes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tickets/:id/notes", async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const text = (req.body?.body ?? "").toString().trim();
    if (!text) return res.status(400).json({ error: "Note body is required" });
    let authorName = "Unknown";
    const userId = req.session.userId;
    if (userId) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (u) authorName = u.name;
    }
    const [note] = await db.insert(ticketNotesTable).values({ ticketId, authorId: userId ?? null, authorName, body: text }).returning();
    res.status(201).json(note);
  } catch (err) {
    req.log.error({ err }, "Failed to add note");
    res.status(400).json({ error: "Invalid input" });
  }
});

// ---- Knowledge Base ----
router.get("/kb", async (req, res) => {
  try {
    const rows = await db.select().from(kbArticlesTable).orderBy(desc(kbArticlesTable.updatedAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list KB");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/kb", async (req, res) => {
  try {
    const title = (req.body?.title ?? "").toString().trim();
    const content = (req.body?.content ?? "").toString().trim();
    if (!title || !content) return res.status(400).json({ error: "Title and content are required" });
    const [a] = await db.insert(kbArticlesTable).values({ title, content }).returning();
    res.status(201).json(a);
  } catch (err) {
    req.log.error({ err }, "Failed to create KB article");
    res.status(400).json({ error: "Invalid input" });
  }
});

router.patch("/kb/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const title = (req.body?.title ?? "").toString().trim();
    const content = (req.body?.content ?? "").toString().trim();
    const [a] = await db.update(kbArticlesTable).set({ title, content, updatedAt: new Date() }).where(eq(kbArticlesTable.id, id)).returning();
    if (!a) return res.status(404).json({ error: "Not found" });
    res.json(a);
  } catch (err) {
    req.log.error({ err }, "Failed to update KB article");
    res.status(400).json({ error: "Invalid input" });
  }
});

router.delete("/kb/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(kbArticlesTable).where(eq(kbArticlesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete KB article");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---- Grounded enhance: uses KB articles as context ----
router.post("/tickets/:id/enhance-draft", async (req, res) => {
  try {
    const draft = (req.body?.draft ?? "").toString().trim();
    if (!draft) return res.status(400).json({ error: "Draft is required" });
    const id = Number(req.params.id);
    const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id)).limit(1);

    const articles = await db.select().from(kbArticlesTable).orderBy(desc(kbArticlesTable.updatedAt));
    const kb = articles.length
      ? "Knowledge base (use only what is relevant; do not contradict it):\n" +
        articles.map((a) => `# ${a.title}\n${a.content}`).join("\n\n") + "\n\n"
      : "";

    const context = ticket ? `The customer issue:\nSubject: ${ticket.subject}\nMessage: ${ticket.body}\n\n` : "";
    const prompt = `You are an expert customer support editor. Improve the following draft reply so it is clear, warm, professional, and well-structured. Ground your improvements in the knowledge base below when relevant. Keep the original meaning and any specific commitments. Do not invent facts or policies not supported by the knowledge base. Return ONLY the improved reply text, no preamble or quotes.\n\n${kb}${context}Draft reply to improve:\n${draft}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 4096 },
    });
    const enhanced = (response.text ?? "").trim();
    if (!enhanced) return res.status(502).json({ error: "No response from AI" });
    res.json({ enhanced });
  } catch (err) {
    req.log.error({ err }, "Failed to enhance draft");
    res.status(500).json({ error: "Failed to enhance draft" });
  }
});

export default router;
