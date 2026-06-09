import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ticketsTable = pgTable("tickets", {
  id: serial("id").primaryKey(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("medium"),
  category: text("category"),
  assigneeId: integer("assignee_id"),
  agentSummary: text("agent_summary"),
  draftResponse: text("draft_response"),
  escalationRisk: text("escalation_risk"),
  escalationReason: text("escalation_reason"),
  policyNotes: text("policy_notes"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTicketSchema = createInsertSchema(ticketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof ticketsTable.$inferSelect;
