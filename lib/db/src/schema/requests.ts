import { integer, jsonb, numeric, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export type RequestType = "refund" | "discount" | "purchase";
export type RequestStatus = "pending" | "approved" | "rejected";
export type DecisionAction = "approve" | "store_credit" | "reject";
export type RiskLevel = "low" | "medium" | "high";

export interface RequestAlternative {
  action: DecisionAction;
  label: string;
  explanation: string;
}

export const requestsTable = pgTable("twinboss_requests", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 20 }).$type<RequestType>().notNull(),
  title: text("title").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
  description: text("description").notNull(),
  staffName: text("staff_name").notNull(),
  staffRole: text("staff_role").notNull().default("Team member"),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  status: varchar("status", { length: 20 }).$type<RequestStatus>().notNull().default("pending"),
  riskLevel: varchar("risk_level", { length: 20 }).$type<RiskLevel>().notNull().default("medium"),
  recommendation: varchar("recommendation", { length: 24 }).$type<DecisionAction>(),
  confidence: integer("confidence"),
  recommendationExplanation: text("recommendation_explanation"),
  alternatives: jsonb("alternatives").$type<RequestAlternative[]>().notNull().default([]),
  recommendationSource: text("recommendation_source"),
  matchedRule: text("matched_rule"),
  decidedAction: varchar("decided_action", { length: 24 }).$type<DecisionAction>(),
  decisionReason: text("decision_reason"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type TwinBossRequest = typeof requestsTable.$inferSelect;
