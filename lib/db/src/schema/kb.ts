import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const kbArticlesTable = pgTable("kb_articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type KbArticle = typeof kbArticlesTable.$inferSelect;
