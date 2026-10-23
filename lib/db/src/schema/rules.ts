import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const rulesTable = pgTable("twinboss_rules", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  source: text("source").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BusinessRule = typeof rulesTable.$inferSelect;
