import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const m = await import("../helpers/integration-db");
  return { db: m.testDb };
});
vi.mock("@/auth", async () => {
  const m = await import("../helpers/integration-db");
  return { auth: () => m.getMockSession() };
});

import { bulkSmartImportAction } from "@/app/actions";
import { clients, presupuestos, recurringServices, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { applyDDL, resetDb, setAuthUser, testDb } from "../helpers/integration-db";
import { TEST_USER_ID, seedClient, seedUser } from "../helpers/factories";

const emptyPayload = () => ({
  clients: [] as { name: string }[],
  presupuestos: [] as {
    name: string;
    clientName: string;
    totalAmount: number;
    type: string;
    status?: string;
  }[],
  recurring: [] as { name: string; clientName: string; amount: number; type: string }[],
  transactions: [] as {
    date: Date;
    imputedDate: Date;
    amount: number;
    category: string;
    description: string;
    targetName?: string;
  }[],
});

beforeAll(async () => {
  await applyDDL();
});
beforeEach(async () => {
  await resetDb();
  await seedUser(testDb);
  setAuthUser(TEST_USER_ID);
});

describe("bulkSmartImportAction", () => {
  it("creates clients, presupuestos, recurring and linked transactions", async () => {
    const payload = emptyPayload();
    payload.clients = [{ name: "Mermoz" }];
    payload.presupuestos = [
      { name: "Web Mermoz", clientName: "mermoz", totalAmount: 1500, type: "ingreso" },
    ];
    payload.recurring = [
      { name: "Hosting", clientName: "MERMOZ", amount: 15, type: "payment" },
    ];
    payload.transactions = [
      {
        date: new Date("2026-03-01T12:00:00Z"),
        imputedDate: new Date("2026-03-01T12:00:00Z"),
        amount: 500,
        category: "presupuesto",
        description: "Hito 1",
        targetName: "web mermoz",
      },
    ];

    const res = await bulkSmartImportAction(payload);
    expect(res.success).toBe(true);

    const c = await testDb.query.clients.findFirst({
      where: eq(clients.name, "Mermoz"),
    });
    const p = await testDb.query.presupuestos.findFirst({
      where: eq(presupuestos.name, "Web Mermoz"),
    });
    const s = await testDb.query.recurringServices.findFirst({
      where: eq(recurringServices.name, "Hosting"),
    });
    expect(c?.id).toBeDefined();
    expect(p?.clientId).toBe(c!.id);
    expect(s?.clientId).toBe(c!.id);

    const txn = await testDb.query.transactions.findFirst({
      where: eq(transactions.description, "Hito 1"),
    });
    expect(txn?.presupuestoId).toBe(p!.id);
  });

  it("reuses an existing client instead of duplicating (case-insensitive)", async () => {
    await seedClient(testDb, { name: "Acme" });
    const payload = emptyPayload();
    payload.clients = [{ name: "ACME" }];

    await bulkSmartImportAction(payload);

    const rows = await testDb.query.clients.findMany({
      where: eq(clients.name, "Acme"),
    });
    expect(rows).toHaveLength(1);
  });

  it("normalizes 'project'/'pago' categories to 'presupuesto'", async () => {
    const payload = emptyPayload();
    payload.transactions = [
      {
        date: new Date("2026-03-01T12:00:00Z"),
        imputedDate: new Date("2026-03-01T12:00:00Z"),
        amount: 10,
        category: "project",
        description: "p1",
      },
      {
        date: new Date("2026-03-02T12:00:00Z"),
        imputedDate: new Date("2026-03-02T12:00:00Z"),
        amount: 20,
        category: "pago",
        description: "p2",
      },
    ];
    await bulkSmartImportAction(payload);
    const rows = await testDb.query.transactions.findMany();
    expect(rows.map((r) => r.category)).toEqual(["presupuesto", "presupuesto"]);
  });

  it("auto-negates transactions linked to an egreso presupuesto", async () => {
    const payload = emptyPayload();
    payload.clients = [{ name: "Prov" }];
    payload.presupuestos = [
      { name: "Licencia", clientName: "Prov", totalAmount: 120, type: "egreso" },
    ];
    payload.transactions = [
      {
        date: new Date("2026-03-01T12:00:00Z"),
        imputedDate: new Date("2026-03-01T12:00:00Z"),
        amount: 120,
        category: "presupuesto",
        description: "pay",
        targetName: "Licencia",
      },
    ];
    await bulkSmartImportAction(payload);
    const txn = await testDb.query.transactions.findFirst({
      where: eq(transactions.description, "pay"),
    });
    expect(txn?.amount).toBe(-120);
  });

  it("auto-finalizes a presupuesto covered by imported transactions", async () => {
    const payload = emptyPayload();
    payload.clients = [{ name: "Cli" }];
    payload.presupuestos = [
      { name: "Done", clientName: "Cli", totalAmount: 100, type: "ingreso" },
    ];
    payload.transactions = [
      {
        date: new Date("2026-03-01T12:00:00Z"),
        imputedDate: new Date("2026-03-01T12:00:00Z"),
        amount: 100,
        category: "presupuesto",
        description: "full",
        targetName: "Done",
      },
    ];
    await bulkSmartImportAction(payload);
    const p = await testDb.query.presupuestos.findFirst({
      where: eq(presupuestos.name, "Done"),
    });
    expect(p?.status).toBe("finalizado");
  });

  it("returns an error object when unauthenticated", async () => {
    setAuthUser(null);
    const res = await bulkSmartImportAction(emptyPayload());
    expect(res.success).toBe(false);
    expect(res.error).toBe("Fallo en la integridad de datos");
  });
});
