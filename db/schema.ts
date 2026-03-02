import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
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
});

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
});

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => clients.id),
  name: text("name").notNull(),
  totalAmount: real("total_amount").notNull(),
  status: text("status").default("en_desarrollo"),
});

export const recurringServices = sqliteTable("recurring_services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => clients.id),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  date: integer("date", { mode: "timestamp" }).notNull(),
  imputedDate: integer("imputed_date", { mode: "timestamp" }),
  amount: real("amount").notNull(),
  category: text("category", {
    enum: ["project", "recurring", "other"],
  }).notNull(),
  description: text("description"),
  projectId: integer("project_id").references(() => projects.id),
  serviceId: integer("service_id").references(() => recurringServices.id),
  status: text("status").default("paid"),
});

// === RELATIONS ===

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  clients: many(clients),
  projects: many(projects),
  transactions: many(transactions),
  recurringServices: many(recurringServices),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, { fields: [clients.userId], references: [users.id] }),
  projects: many(projects),
  services: many(recurringServices),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  client: one(clients, {
    fields: [projects.clientId],
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
  project: one(projects, {
    fields: [transactions.projectId],
    references: [projects.id],
  }),
  service: one(recurringServices, {
    fields: [transactions.serviceId],
    references: [recurringServices.id],
  }),
}));
