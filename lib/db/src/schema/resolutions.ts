import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const resolutionsTable = pgTable("resolutions", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  agentName: text("agent_name").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  issue: text("issue").notNull(),
  resolution: text("resolution").notNull(),
  resolvedAt: timestamp("resolved_at").notNull().defaultNow(),
});

export type Resolution = typeof resolutionsTable.$inferSelect;
