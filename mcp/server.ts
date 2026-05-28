#!/usr/bin/env node
/**
 * Fiscus MCP server — exposes the freelance-accountant data layer over the
 * Model Context Protocol so Claude can read and mutate the same DB the web
 * app uses.
 *
 * Run with:   pnpm mcp              (uses tsx)
 * Transport:  stdio
 *
 * Env:
 *   TURSO_DATABASE_URL   libsql://… (Turso), file:./local.db, or :memory:
 *   TURSO_AUTH_TOKEN     auth token for Turso (omit for file:/memory:)
 *   MCP_USER_ID          scope all operations to this user id. If unset and
 *                        exactly one user exists in the DB, that user is used
 *                        automatically.
 */
import { config as loadDotenv } from "dotenv";
// Best-effort: load .env.local from the project root so the server works
// regardless of how Claude Code/Desktop launched it. Real env vars still win.
// `quiet` suppresses dotenv's stdout banner — stdio MCP transport requires
// stdout to carry ONLY JSON-RPC.
loadDotenv({ path: ".env.local", quiet: true });
loadDotenv({ path: ".env", quiet: true });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { and, between, desc, eq } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/db/schema";
import {
  clients,
  presupuestos,
  recurringServices,
  transactions,
} from "@/db/schema";

const rawUrl = process.env.TURSO_DATABASE_URL;
if (!rawUrl) {
  console.error(
    "[fiscus-mcp] TURSO_DATABASE_URL is required (file:, :memory:, or libsql:// URL).",
  );
  process.exit(1);
}

const client = createClient({
  url: rawUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client, { schema });

// resolved in main() before tools are registered
let USER_ID: string;

async function resolveUserId(): Promise<string> {
  if (process.env.MCP_USER_ID) return process.env.MCP_USER_ID;
  const all = await db.query.users.findMany({ columns: { id: true } });
  if (all.length === 1) return all[0].id;
  if (all.length === 0) {
    console.error("[fiscus-mcp] No users in the DB. Set MCP_USER_ID.");
    process.exit(1);
  }
  console.error(
    `[fiscus-mcp] Multiple users (${all.length}) in the DB. Set MCP_USER_ID to one of: ${all.map((u) => u.id).join(", ")}`,
  );
  process.exit(1);
}

// --- helpers ---
const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});
const fail = (message: string) => ({
  content: [{ type: "text" as const, text: message }],
  isError: true,
});

const parseDate = (s: string) => new Date(s.includes("T") ? s : s + "T12:00:00Z");

const server = new McpServer(
  { name: "fiscus", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

// ---------------- clients ----------------

const KIND = z.enum(["customer", "collaborator", "vendor"]);

server.registerTool(
  "list_clients",
  {
    description:
      "List clients (entities) for the current user. Filter by kind to find collaborators you pay or vendors.",
    inputSchema: {
      status: z.enum(["active", "inactive", "archived"]).optional(),
      kind: KIND.optional(),
    },
  },
  async ({ status, kind }) => {
    const conds = [eq(clients.userId, USER_ID)];
    if (status) conds.push(eq(clients.status, status));
    if (kind) conds.push(eq(clients.kind, kind));
    const rows = await db.query.clients.findMany({ where: and(...conds) });
    return ok(rows);
  },
);

server.registerTool(
  "create_client",
  {
    description:
      "Create a new entity. `kind` distinguishes customers (default), collaborators you pay (e.g. a contractor) and vendors.",
    inputSchema: {
      name: z.string().min(1),
      status: z.enum(["active", "inactive"]).default("active"),
      kind: KIND.default("customer"),
    },
  },
  async ({ name, status, kind }) => {
    const [row] = await db
      .insert(clients)
      .values({ name, status, kind, userId: USER_ID })
      .returning();
    return ok(row);
  },
);

server.registerTool(
  "update_client",
  {
    description: "Update a client/entity by id.",
    inputSchema: {
      id: z.number().int(),
      name: z.string().min(1).optional(),
      status: z.enum(["active", "inactive", "archived"]).optional(),
      kind: KIND.optional(),
    },
  },
  async ({ id, ...patch }) => {
    await db
      .update(clients)
      .set(patch)
      .where(and(eq(clients.id, id), eq(clients.userId, USER_ID)));
    return ok({ success: true });
  },
);

server.registerTool(
  "get_outstanding_per_entity",
  {
    description:
      "Per-entity balance of money still owed. Sums egreso presupuestos and subtracts paid transactions. Pass `kind: 'collaborator'` to see only contractors you pay.",
    inputSchema: { kind: KIND.optional() },
  },
  async ({ kind }) => {
    const conds = [eq(clients.userId, USER_ID)];
    if (kind) conds.push(eq(clients.kind, kind));
    const rows = await db.query.clients.findMany({
      where: and(...conds),
      with: {
        presupuestos: {
          where: eq(presupuestos.type, "egreso"),
          with: { transactions: true },
        },
      },
    });
    const result = rows
      .filter((c) => c.presupuestos.length > 0)
      .map((c) => {
        const totalOwed = c.presupuestos.reduce(
          (s, p) => s + Math.abs(p.totalAmount),
          0,
        );
        const totalPaid = c.presupuestos.reduce(
          (s, p) =>
            s + p.transactions.reduce((ts, t) => ts + Math.abs(t.amount), 0),
          0,
        );
        return {
          clientId: c.id,
          clientName: c.name,
          kind: c.kind,
          totalOwed,
          totalPaid,
          outstanding: Math.max(0, totalOwed - totalPaid),
        };
      });
    return ok(result);
  },
);

server.registerTool(
  "delete_client",
  {
    description:
      "Delete a client. Refuses to delete if presupuestos or recurring services are linked to it.",
    inputSchema: { id: z.number().int() },
  },
  async ({ id }) => {
    const linkedP = await db.query.presupuestos.findFirst({
      where: and(eq(presupuestos.clientId, id), eq(presupuestos.userId, USER_ID)),
    });
    const linkedR = await db.query.recurringServices.findFirst({
      where: and(
        eq(recurringServices.clientId, id),
        eq(recurringServices.userId, USER_ID),
      ),
    });
    if (linkedP || linkedR) {
      return fail("Client has linked presupuestos or recurring services.");
    }
    await db
      .delete(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, USER_ID)));
    return ok({ success: true });
  },
);

// ---------------- presupuestos ----------------

async function recheckPresupuesto(presupuestoId: number) {
  const p = await db.query.presupuestos.findFirst({
    where: eq(presupuestos.id, presupuestoId),
    with: { transactions: true },
  });
  if (!p) return;
  const totalPaid = p.transactions.reduce((s, t) => s + Math.abs(t.amount), 0);
  const newStatus =
    totalPaid >= Math.abs(p.totalAmount) ? "finalizado" : "activo";
  if (p.status !== newStatus) {
    await db
      .update(presupuestos)
      .set({ status: newStatus })
      .where(eq(presupuestos.id, presupuestoId));
  }
}

server.registerTool(
  "list_presupuestos",
  {
    description: "List presupuestos (budgets) for the current user.",
    inputSchema: {
      type: z.enum(["ingreso", "egreso"]).optional(),
      status: z.string().optional(),
      clientId: z.number().int().optional(),
    },
  },
  async ({ type, status, clientId }) => {
    const conds = [eq(presupuestos.userId, USER_ID)];
    if (type) conds.push(eq(presupuestos.type, type));
    if (status) conds.push(eq(presupuestos.status, status));
    if (clientId !== undefined) conds.push(eq(presupuestos.clientId, clientId));
    const rows = await db.query.presupuestos.findMany({
      where: and(...conds),
      with: { client: true },
    });
    return ok(rows);
  },
);

server.registerTool(
  "create_presupuesto",
  {
    description: "Create a presupuesto (ingreso or egreso).",
    inputSchema: {
      name: z.string().min(1),
      clientId: z.number().int(),
      totalAmount: z.number(),
      type: z.enum(["ingreso", "egreso"]),
      status: z.string().default("activo"),
    },
  },
  async (input) => {
    const [row] = await db
      .insert(presupuestos)
      .values({ ...input, userId: USER_ID })
      .returning();
    return ok(row);
  },
);

server.registerTool(
  "update_presupuesto",
  {
    description: "Update fields on a presupuesto.",
    inputSchema: {
      id: z.number().int(),
      name: z.string().optional(),
      totalAmount: z.number().optional(),
      status: z.string().optional(),
      type: z.enum(["ingreso", "egreso"]).optional(),
      clientId: z.number().int().optional(),
    },
  },
  async ({ id, ...patch }) => {
    await db
      .update(presupuestos)
      .set(patch)
      .where(and(eq(presupuestos.id, id), eq(presupuestos.userId, USER_ID)));
    await recheckPresupuesto(id);
    return ok({ success: true });
  },
);

server.registerTool(
  "delete_presupuesto",
  {
    description:
      "Delete a presupuesto. Linked transactions are kept; their presupuestoId is set to null.",
    inputSchema: { id: z.number().int() },
  },
  async ({ id }) => {
    await db.transaction(async (tx) => {
      await tx
        .update(transactions)
        .set({ presupuestoId: null })
        .where(eq(transactions.presupuestoId, id));
      await tx
        .delete(presupuestos)
        .where(and(eq(presupuestos.id, id), eq(presupuestos.userId, USER_ID)));
    });
    return ok({ success: true });
  },
);

// ---------------- recurring services ----------------

server.registerTool(
  "list_recurring",
  {
    description: "List recurring services (service=income, payment=expense).",
    inputSchema: { type: z.enum(["service", "payment"]).optional() },
  },
  async ({ type }) => {
    const rows = await db.query.recurringServices.findMany({
      where: type
        ? and(
            eq(recurringServices.userId, USER_ID),
            eq(recurringServices.type, type),
          )
        : eq(recurringServices.userId, USER_ID),
      with: { client: true },
    });
    return ok(rows);
  },
);

server.registerTool(
  "create_recurring",
  {
    description:
      "Create a recurring service. `startDate` defaults to today; `endDate` is optional (omit for ongoing).",
    inputSchema: {
      name: z.string().min(1),
      clientId: z.number().int(),
      amount: z.number(),
      type: z.enum(["service", "payment"]).default("service"),
      billingDay: z.number().int().min(1).max(31).default(1),
      startDate: z
        .string()
        .describe("ISO date, e.g. 2026-01-01")
        .optional(),
      endDate: z.string().optional(),
    },
  },
  async ({ startDate, endDate, ...rest }) => {
    const [row] = await db
      .insert(recurringServices)
      .values({
        ...rest,
        createdAt: new Date(),
        startDate: startDate ? parseDate(startDate) : new Date(),
        endDate: endDate ? parseDate(endDate) : null,
        userId: USER_ID,
      })
      .returning();
    return ok(row);
  },
);

server.registerTool(
  "update_recurring",
  {
    description:
      "Update a recurring service. Pass `endDate` to mark a service as ended (e.g. you lost the client); pass `endDate: null` to reopen.",
    inputSchema: {
      id: z.number().int(),
      name: z.string().optional(),
      amount: z.number().optional(),
      billingDay: z.number().int().min(1).max(31).optional(),
      type: z.enum(["service", "payment"]).optional(),
      clientId: z.number().int().optional(),
      startDate: z.string().optional(),
      endDate: z.string().nullable().optional(),
    },
  },
  async ({ id, startDate, endDate, ...patch }) => {
    const set: Record<string, unknown> = { ...patch };
    if (startDate !== undefined) set.startDate = parseDate(startDate);
    if (endDate !== undefined)
      set.endDate = endDate === null ? null : parseDate(endDate);
    await db
      .update(recurringServices)
      .set(set)
      .where(
        and(
          eq(recurringServices.id, id),
          eq(recurringServices.userId, USER_ID),
        ),
      );
    return ok({ success: true });
  },
);

server.registerTool(
  "delete_recurring",
  {
    description:
      "Delete a recurring service. Linked transactions are kept; their serviceId is set to null.",
    inputSchema: { id: z.number().int() },
  },
  async ({ id }) => {
    await db.transaction(async (tx) => {
      await tx
        .update(transactions)
        .set({ serviceId: null })
        .where(eq(transactions.serviceId, id));
      await tx
        .delete(recurringServices)
        .where(
          and(
            eq(recurringServices.id, id),
            eq(recurringServices.userId, USER_ID),
          ),
        );
    });
    return ok({ success: true });
  },
);

// ---------------- transactions ----------------

server.registerTool(
  "list_transactions",
  {
    description:
      "List transactions, optionally filtered by date range/category/links.",
    inputSchema: {
      fromDate: z
        .string()
        .describe("ISO date, e.g. 2026-01-01")
        .optional(),
      toDate: z.string().optional(),
      category: z.enum(["presupuesto", "recurring", "other"]).optional(),
      presupuestoId: z.number().int().optional(),
      serviceId: z.number().int().optional(),
      limit: z.number().int().min(1).max(500).default(100),
    },
  },
  async ({ fromDate, toDate, category, presupuestoId, serviceId, limit }) => {
    const conds = [eq(transactions.userId, USER_ID)];
    if (fromDate && toDate) {
      conds.push(between(transactions.date, parseDate(fromDate), parseDate(toDate)));
    }
    if (category) conds.push(eq(transactions.category, category));
    if (presupuestoId !== undefined)
      conds.push(eq(transactions.presupuestoId, presupuestoId));
    if (serviceId !== undefined) conds.push(eq(transactions.serviceId, serviceId));
    const rows = await db.query.transactions.findMany({
      where: and(...conds),
      orderBy: [desc(transactions.date)],
      limit,
      with: {
        presupuesto: { with: { client: true } },
        service: { with: { client: true } },
      },
    });
    return ok(rows);
  },
);

server.registerTool(
  "create_transaction",
  {
    description:
      "Create a transaction. If linked to an egreso presupuesto, the amount is auto-negated; presupuesto status is auto-finalized when fully paid.",
    inputSchema: {
      date: z.string().describe("ISO date, e.g. 2026-03-15"),
      amount: z.number(),
      category: z.enum(["presupuesto", "recurring", "other"]),
      description: z.string().optional(),
      presupuestoId: z.number().int().optional(),
      serviceId: z.number().int().optional(),
      imputedDate: z.string().optional(),
    },
  },
  async ({ date, amount, category, description, presupuestoId, serviceId, imputedDate }) => {
    let finalAmount = amount;
    if (presupuestoId !== undefined) {
      const linked = await db.query.presupuestos.findFirst({
        where: eq(presupuestos.id, presupuestoId),
      });
      if (linked?.type === "egreso" && finalAmount > 0) {
        finalAmount = -finalAmount;
      }
    }
    const [row] = await db
      .insert(transactions)
      .values({
        date: parseDate(date),
        imputedDate: imputedDate ? parseDate(imputedDate) : null,
        amount: finalAmount,
        category,
        description: description ?? null,
        presupuestoId: presupuestoId ?? null,
        serviceId: serviceId ?? null,
        userId: USER_ID,
      })
      .returning();
    if (presupuestoId !== undefined) {
      await recheckPresupuesto(presupuestoId);
    }
    return ok(row);
  },
);

server.registerTool(
  "update_transaction",
  {
    description: "Update a transaction.",
    inputSchema: {
      id: z.number().int(),
      date: z.string().optional(),
      amount: z.number().optional(),
      category: z.enum(["presupuesto", "recurring", "other"]).optional(),
      description: z.string().optional(),
      presupuestoId: z.number().int().nullable().optional(),
      serviceId: z.number().int().nullable().optional(),
      imputedDate: z.string().nullable().optional(),
    },
  },
  async ({ id, date, imputedDate, ...patch }) => {
    const set: Record<string, unknown> = { ...patch };
    if (date !== undefined) set.date = parseDate(date);
    if (imputedDate !== undefined)
      set.imputedDate = imputedDate ? parseDate(imputedDate) : null;
    const existing = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.userId, USER_ID)),
    });
    await db
      .update(transactions)
      .set(set)
      .where(and(eq(transactions.id, id), eq(transactions.userId, USER_ID)));
    if (existing?.presupuestoId) await recheckPresupuesto(existing.presupuestoId);
    if (typeof patch.presupuestoId === "number")
      await recheckPresupuesto(patch.presupuestoId);
    return ok({ success: true });
  },
);

server.registerTool(
  "delete_transaction",
  {
    description: "Delete a transaction. Linked presupuesto status is re-checked.",
    inputSchema: { id: z.number().int() },
  },
  async ({ id }) => {
    const t = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.userId, USER_ID)),
    });
    await db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, USER_ID)));
    if (t?.presupuestoId) await recheckPresupuesto(t.presupuestoId);
    return ok({ success: true });
  },
);

// ---------------- analytics ----------------

server.registerTool(
  "get_dashboard_summary",
  {
    description:
      "Aggregate totals over a date range, grouped by category and by month.",
    inputSchema: {
      fromDate: z.string(),
      toDate: z.string(),
    },
  },
  async ({ fromDate, toDate }) => {
    const rows = await db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, USER_ID),
        between(transactions.date, parseDate(fromDate), parseDate(toDate)),
      ),
    });
    const totals = { ingreso: 0, egreso: 0, recurring: 0, other: 0, net: 0 };
    const byMonth: Record<string, number> = {};
    for (const r of rows) {
      const key = (r.imputedDate ?? r.date).toISOString().slice(0, 7);
      byMonth[key] = (byMonth[key] || 0) + r.amount;
      if (r.category === "recurring") totals.recurring += r.amount;
      else if (r.category === "other") totals.other += r.amount;
      else if (r.amount >= 0) totals.ingreso += r.amount;
      else totals.egreso += r.amount;
      totals.net += r.amount;
    }
    return ok({ totals, byMonth, count: rows.length });
  },
);

server.registerTool(
  "get_recurring_coverage",
  {
    description:
      "For each recurring service, list payments grouped by imputed month over the given range.",
    inputSchema: { fromDate: z.string(), toDate: z.string() },
  },
  async ({ fromDate, toDate }) => {
    const services = await db.query.recurringServices.findMany({
      where: eq(recurringServices.userId, USER_ID),
      with: { client: true },
    });
    const txns = await db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, USER_ID),
        eq(transactions.category, "recurring"),
        between(transactions.date, parseDate(fromDate), parseDate(toDate)),
      ),
    });
    const result = services.map((s) => {
      const own = txns.filter((t) => t.serviceId === s.id);
      const paymentsByMonth: Record<string, number> = {};
      let totalCollected = 0;
      own.forEach((t) => {
        const key = (t.imputedDate ?? t.date).toISOString().slice(0, 7);
        paymentsByMonth[key] = (paymentsByMonth[key] || 0) + t.amount;
        totalCollected += t.amount;
      });
      return {
        serviceId: s.id,
        serviceName: s.name,
        clientName: s.client?.name ?? "Sin Entidad",
        monthlyFee: s.amount,
        totalCollected,
        paymentsByMonth,
      };
    });
    return ok(result);
  },
);

server.registerTool(
  "set_slack_webhook",
  {
    description:
      "Save (or clear) the Slack incoming-webhook URL used for recurring-payment reminders. Pass `url: null` to disable.",
    inputSchema: { url: z.string().url().nullable() },
  },
  async ({ url }) => {
    await db
      .update(schema.users)
      .set({ slackWebhookUrl: url })
      .where(eq(schema.users.id, USER_ID));
    return ok({ success: true });
  },
);

server.registerTool(
  "send_recurring_reminders",
  {
    description:
      "Compute which recurring services are due today (billingDay == today, current month unpaid, active lifecycle) and post a Slack message via the configured webhook. Pass `date` (YYYY-MM-DD) to dry-run for another day. Returns the due list either way.",
    inputSchema: { date: z.string().optional() },
  },
  async ({ date }) => {
    const today = date ? parseDate(date) : new Date();
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, USER_ID),
      columns: { slackWebhookUrl: true },
    });

    const monthStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth() + 1,
        0,
        23, 59, 59, 999,
      ),
    );

    const services = await db.query.recurringServices.findMany({
      where: eq(recurringServices.userId, USER_ID),
      with: { client: true },
    });
    const txns = await db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, USER_ID),
        eq(transactions.category, "recurring"),
        between(transactions.date, monthStart, monthEnd),
      ),
      columns: {
        serviceId: true,
        category: true,
        date: true,
        imputedDate: true,
      },
    });

    const { findDueReminders, buildSlackMessage } = await import("@/lib/reminders");
    const due = findDueReminders(services, txns, today);

    if (!user?.slackWebhookUrl) {
      return ok({ sent: false, reason: "no_webhook_configured", due });
    }
    if (due.length === 0) {
      return ok({ sent: false, reason: "nothing_due", due });
    }
    const res = await fetch(user.slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSlackMessage(due, today)),
    });
    if (!res.ok) {
      return fail(`Slack webhook ${res.status}: ${await res.text()}`);
    }
    return ok({ sent: true, due });
  },
);

server.registerTool(
  "whoami",
  {
    description: "Return the userId currently scoped by this MCP server.",
    inputSchema: {},
  },
  async () => ok({ userId: USER_ID }),
);

void schema; // imported for drizzle relations typing

async function main() {
  USER_ID = await resolveUserId();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[fiscus-mcp] connected (user=${USER_ID})`);
}

main().catch((err) => {
  console.error("[fiscus-mcp] fatal:", err);
  process.exit(1);
});
