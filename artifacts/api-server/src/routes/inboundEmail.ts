import { Router } from "express";
import { db, ticketsTable } from "@workspace/db";

const router = Router();

function pick(obj: any, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = k.split(".").reduce((o: any, p) => (o == null ? o : o[p]), obj);
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

// Public webhook: an inbound-email service POSTs here when mail arrives.
// Protected by a shared token (set INBOUND_EMAIL_TOKEN in .env).
router.post("/inbound-email", async (req, res) => {
  try {
    const expected = process.env.INBOUND_EMAIL_TOKEN;
    if (!expected) return res.status(500).json({ error: "Inbound email not configured" });

    const provided = (req.query.token as string) || req.header("x-webhook-token");
    if (provided !== expected) return res.status(401).json({ error: "Invalid token" });

    const body = req.body ?? {};
    const fromRaw = pick(body, ["from", "sender", "From", "envelope.from", "fromEmail"]);
    if (!fromRaw) return res.status(400).json({ error: "Missing sender email" });

    const match = fromRaw.match(/<([^>]+)>/);
    const cleanEmail = match ? match[1] : fromRaw;
    const fromName =
      pick(body, ["fromName", "FromName", "from_name"]) || cleanEmail.split("@")[0];
    const subject = pick(body, ["subject", "Subject"]) || "(no subject)";
    const text = pick(body, ["text", "body", "TextBody", "body-plain", "plain", "stripped-text"]) || "";

    const [ticket] = await db
      .insert(ticketsTable)
      .values({
        subject,
        body: text,
        customerName: fromName,
        customerEmail: cleanEmail,
        priority: "medium",
      })
      .returning();

    req.log.info({ ticketId: ticket.id }, "Created ticket from inbound email");
    res.status(201).json({ ok: true, ticketId: ticket.id });
  } catch (err) {
    req.log.error({ err }, "Inbound email failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
