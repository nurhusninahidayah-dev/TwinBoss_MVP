import { integer, numeric, pgTable, serial, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { requestsTable } from "./requests";
import type { DecisionAction } from "./requests";

export const receiptsTable = pgTable(
  "twinboss_receipts",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id").notNull().references(() => requestsTable.id, { onDelete: "cascade" }),
    receiptNumber: varchar("receipt_number", { length: 32 }).notNull().unique(),
    requestedAmount: numeric("requested_amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    requestedAction: varchar("requested_action", { length: 24 }).$type<DecisionAction>(),
    chosenAction: varchar("chosen_action", { length: 24 }).$type<DecisionAction>().notNull(),
    reason: text("reason"),
    ruleApplied: text("rule_applied"),
    decisionBy: text("decision_by").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
    syncStatus: text("sync_status").notNull().default("Synced to Orbyte Hub"),
    learningNote: text("learning_note"),
  },
  (table) => [unique("twinboss_receipts_request_id_unique").on(table.requestId)],
);

export type DecisionReceiptRecord = typeof receiptsTable.$inferSelect;
