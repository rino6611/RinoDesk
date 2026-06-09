import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const ticketNotesTable = pgTable("ticket_notes", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  authorId: integer("author_id"),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TicketNote = typeof ticketNotesTable.$inferSelect;
