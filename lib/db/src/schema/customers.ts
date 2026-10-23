import { integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const customersTable = pgTable("twinboss_customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  tier: text("tier").notNull().default("Standard"),
  lifetimeValue: numeric("lifetime_value", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
  orders: integer("orders").notNull().default(0),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Customer = typeof customersTable.$inferSelect;
