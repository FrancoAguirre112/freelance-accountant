import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// === AUTH.JS TABLES ===

export const users = sqliteTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
  profileType: text("profileType", { enum: ["programador", "marketing"] }),
  // Slack incoming-webhook URL used by the daily recurring-payments reminder
  // job. Null = the user opted out.
  slackWebhookUrl: text("slackWebhookUrl"),
});

export const accounts = sqliteTable("account", {
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (table) => [
  index("accounts_user_id_idx").on(table.userId),
]);

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable("verificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

// === APPLICATION TABLES ===

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").default("active"),
  kind: text("kind", { enum: ["customer", "collaborator", "vendor"] }).default(
    "customer",
  ),
}, (table) => [
  index("clients_user_id_idx").on(table.userId),
]);

export const presupuestos = sqliteTable("presupuestos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => clients.id),
  name: text("name").notNull(),
  totalAmount: real("total_amount").notNull(),
  type: text("type", { enum: ["ingreso", "egreso"] }).notNull(),
  status: text("status").default("activo"),
}, (table) => [
  index("presupuestos_user_id_idx").on(table.userId),
]);

export const recurringServices = sqliteTable("recurring_services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => clients.id),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  type: text("type", { enum: ["service", "payment"] }).notNull().default("service"),
  billingDay: integer("billing_day").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp" }),
  // Business-meaning lifecycle: the recurrence is active only while
  // startDate <= now <= (endDate ?? +infinity). Used to hide ended
  // services from past/future date ranges in the dashboard.
  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp" }),
}, (table) => [
  index("recurring_services_user_id_idx").on(table.userId),
]);

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  date: integer("date", { mode: "timestamp" }).notNull(),
  imputedDate: integer("imputed_date", { mode: "timestamp" }),
  amount: real("amount").notNull(),
  category: text("category", {
    enum: ["presupuesto", "recurring", "other"],
  }).notNull(),
  description: text("description"),
  presupuestoId: integer("presupuesto_id").references(() => presupuestos.id),
  serviceId: integer("service_id").references(() => recurringServices.id),
  status: text("status").default("paid"),
}, (table) => [
  index("transactions_user_id_idx").on(table.userId),
  index("transactions_user_date_idx").on(table.userId, table.date),
]);

// === RELATIONS ===

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  clients: many(clients),
  presupuestos: many(presupuestos),
  transactions: many(transactions),
  recurringServices: many(recurringServices),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, { fields: [clients.userId], references: [users.id] }),
  presupuestos: many(presupuestos),
  services: many(recurringServices),
}));

export const presupuestosRelations = relations(presupuestos, ({ one, many }) => ({
  user: one(users, { fields: [presupuestos.userId], references: [users.id] }),
  client: one(clients, {
    fields: [presupuestos.clientId],
    references: [clients.id],
  }),
  transactions: many(transactions),
}));

export const recurringServicesRelations = relations(
  recurringServices,
  ({ one }) => ({
    user: one(users, { fields: [recurringServices.userId], references: [users.id] }),
    client: one(clients, {
      fields: [recurringServices.clientId],
      references: [clients.id],
    }),
  }),
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  presupuesto: one(presupuestos, {
    fields: [transactions.presupuestoId],
    references: [presupuestos.id],
  }),
  service: one(recurringServices, {
    fields: [transactions.serviceId],
    references: [recurringServices.id],
  }),
}));
