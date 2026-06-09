/**
 * Seeds the database with a handful of sample support tickets so the
 * dashboard and inbox aren't empty on first run.
 *
 * Run with:  pnpm db:seed   (from the repo root)
 *
 * These tickets are inserted "raw" (no AI fields populated). Open one in the
 * UI and click "Process" to watch the agent pipeline fill in the rest.
 */
import { db, pool, ticketsTable } from "./index";

const sampleTickets = [
  {
    subject: "Charged twice for my monthly subscription",
    body: "Hi, I just checked my bank statement and I was billed twice this month for the Pro plan. Can you refund the duplicate charge? This is really frustrating.",
    customerName: "Maria Santos",
    customerEmail: "maria.santos@example.com",
    priority: "high",
  },
  {
    subject: "Order hasn't shipped after 5 days",
    body: "I placed order #48213 last Friday and it still says 'processing'. I paid for express shipping. When will it actually ship?",
    customerName: "David Cruz",
    customerEmail: "dcruz@example.com",
    priority: "medium",
  },
  {
    subject: "How do I export my data?",
    body: "Quick question — is there a way to export all my reports to CSV? I couldn't find the option in settings.",
    customerName: "Aiko Tanaka",
    customerEmail: "aiko.t@example.com",
    priority: "low",
  },
  {
    subject: "App keeps crashing on login",
    body: "Every time I try to log in on the mobile app it crashes immediately. I'm on the latest version. I've already reinstalled twice. Please help, I have a deadline.",
    customerName: "Liam O'Brien",
    customerEmail: "liam.obrien@example.com",
    priority: "high",
  },
  {
    subject: "Want to cancel and get a refund",
    body: "This product did not work as advertised and I want a full refund and to cancel immediately. I am extremely disappointed and will be leaving a review.",
    customerName: "Grace Mwangi",
    customerEmail: "grace.m@example.com",
    priority: "high",
  },
];

async function seed() {
  console.log(`Seeding ${sampleTickets.length} tickets...`);
  const inserted = await db.insert(ticketsTable).values(sampleTickets).returning();
  console.log(`Inserted ${inserted.length} tickets.`);
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
