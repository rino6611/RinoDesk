import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendSlackAlert } from "../lib/slack";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router = Router();

async function getOrCreateSettings() {
  const rows = await db.select().from(settingsTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [created] = await db
    .insert(settingsTable)
    .values({ alertsEnabled: false, alertOnHigh: true, alertOnMedium: false })
    .returning();
  return created;
}

router.get("/settings", async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(settings);
  } catch (err) {
    req.log.error({ err }, "Failed to get settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/settings", async (req, res) => {
  try {
    const body = UpdateSettingsBody.parse(req.body);
    const settings = await getOrCreateSettings();
    const [updated] = await db
      .update(settingsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(settingsTable.id, settings.id))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    res.status(400).json({ error: "Invalid input" });
  }
});

router.post("/settings/test-alert", async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    if (!settings.slackWebhookUrl) {
      res.json({ success: false, message: "No Slack webhook URL configured. Please add one first." });
      return;
    }
    await sendSlackAlert(settings.slackWebhookUrl, {
      id: 0,
      subject: "Test alert from RinoDesk AgentOS",
      customerName: "Test Customer",
      customerEmail: "test@example.com",
      priority: "high",
      escalationRisk: "high",
      escalationReason: "This is a test alert to verify your Slack integration is working correctly.",
    });
    res.json({ success: true, message: "Test alert sent successfully. Check your Slack channel." });
  } catch (err) {
    req.log.error({ err }, "Failed to send test alert");
    res.json({ success: false, message: `Failed to send: ${err instanceof Error ? err.message : "Unknown error"}` });
  }
});

export { getOrCreateSettings };
export default router;
