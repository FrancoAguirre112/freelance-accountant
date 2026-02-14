import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  status: text("status").default("active"),
});

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").references(() => clients.id),
  name: text("name").notNull(),
  totalAmount: real("total_amount").notNull(),
  status: text("status").default("en_desarrollo"),
});

export const recurringServices = sqliteTable("recurring_services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").references(() => clients.id),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  type: text("type", { enum: ["maintenance", "salary"] }).notNull(),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: integer("date", { mode: "timestamp" }).notNull(),
  imputedDate: integer("imputed_date", { mode: "timestamp" }),
  amount: real("amount").notNull(),
  category: text("category", {
    enum: ["project", "salary", "maintenance", "other"],
  }).notNull(),
  description: text("description"),
  projectId: integer("project_id").references(() => projects.id),
  serviceId: integer("service_id").references(() => recurringServices.id),
  status: text("status").default("paid"),
});

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects),
  services: many(recurringServices),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  transactions: many(transactions),
}));

export const recurringServicesRelations = relations(
  recurringServices,
  ({ one }) => ({
    client: one(clients, {
      fields: [recurringServices.clientId],
      references: [clients.id],
    }),
  }),
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  project: one(projects, {
    fields: [transactions.projectId],
    references: [projects.id],
  }),
  service: one(recurringServices, {
    fields: [transactions.serviceId],
    references: [recurringServices.id],
  }),
}));
