import { pgTable, text, boolean, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  slackWebhookUrl: text("slack_webhook_url"),
  alertsEnabled: boolean("alerts_enabled").notNull().default(false),
  alertOnHigh: boolean("alert_on_high").notNull().default(true),
  alertOnMedium: boolean("alert_on_medium").notNull().default(false),
  notifyEmail: text("notify_email"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true, updatedAt: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
