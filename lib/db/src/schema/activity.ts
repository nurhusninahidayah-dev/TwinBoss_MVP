import { integer, numeric, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { requestsTable } from "./requests";
import type { DecisionAction } from "./requests";

export const activityTable = pgTable("twinboss_activity", {
  id: serial("id").primaryKey(),
  kind: varchar("kind", { length: 32 }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  actor: text("actor").notNull(),
  requestId: integer("request_id").references(() => requestsTable.id, { onDelete: "set null" }),
  amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }),
  action: varchar("action", { length: 24 }).$type<DecisionAction>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Activity = typeof activityTable.$inferSelect;
