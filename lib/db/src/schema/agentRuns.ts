import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentRunsTable = pgTable("agent_runs", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  agentName: text("agent_name").notNull(),
  status: text("status").notNull().default("running"),
  output: text("output"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAgentRunSchema = createInsertSchema(agentRunsTable).omit({ id: true, createdAt: true });
export type InsertAgentRun = z.infer<typeof insertAgentRunSchema>;
export type AgentRun = typeof agentRunsTable.$inferSelect;
