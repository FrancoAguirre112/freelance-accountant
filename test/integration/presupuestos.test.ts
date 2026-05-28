import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const m = await import("../helpers/integration-db");
  return { db: m.testDb };
});
vi.mock("@/auth", async () => {
  const m = await import("../helpers/integration-db");
  return { auth: () => m.getMockSession() };
});

import {
  createPresupuestoAction,
  createTransactionAction,
  deletePresupuestoAction,
  deleteTransactionAction,
  updatePresupuestoAction,
} from "@/app/actions";
import { presupuestos, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { applyDDL, resetDb, setAuthUser, testDb } from "../helpers/integration-db";
import {
  TEST_USER_ID,
  seedClient,
  seedPresupuesto,
  seedTransaction,
  seedUser,
} from "../helpers/factories";

beforeAll(async () => {
  await applyDDL();
});
beforeEach(async () => {
  await resetDb();
  await seedUser(testDb);
  setAuthUser(TEST_USER_ID);
});

describe("createPresupuestoAction", () => {
  it("creates with default status 'activo'", async () => {
    const c = await seedClient(testDb);
    const res = await createPresupuestoAction({
      name: "Web",
      clientId: c.id,
      totalAmount: 1000,
      type: "ingreso",
    });
    expect(res.success).toBe(true);
    const row = await testDb.query.presupuestos.findFirst({
      where: eq(presupuestos.name, "Web"),
    });
    expect(row).toMatchObject({
      status: "activo",
      type: "ingreso",
      userId: TEST_USER_ID,
    });
  });
});

describe("updatePresupuestoAction", () => {
  it("updates the total amount", async () => {
    const p = await seedPresupuesto(testDb, { totalAmount: 100 });
    await updatePresupuestoAction(p.id, { totalAmount: 250 });
    const row = await testDb.query.presupuestos.findFirst({
      where: eq(presupuestos.id, p.id),
    });
    expect(row?.totalAmount).toBe(250);
  });
});

describe("auto-finalization via transactions", () => {
  it("marks an ingreso presupuesto 'finalizado' once fully paid", async () => {
    const p = await seedPresupuesto(testDb, { totalAmount: 300, type: "ingreso" });
    await createTransactionAction({
      date: new Date("2026-03-01T12:00:00Z"),
      amount: 300,
      category: "presupuesto",
      presupuestoId: p.id,
    });
    const row = await testDb.query.presupuestos.findFirst({
      where: eq(presupuestos.id, p.id),
    });
    expect(row?.status).toBe("finalizado");
  });

  it("stays 'activo' while underpaid", async () => {
    const p = await seedPresupuesto(testDb, { totalAmount: 300 });
    await createTransactionAction({
      date: new Date("2026-03-01T12:00:00Z"),
      amount: 100,
      category: "presupuesto",
      presupuestoId: p.id,
    });
    const row = await testDb.query.presupuestos.findFirst({
      where: eq(presupuestos.id, p.id),
    });
    expect(row?.status).toBe("activo");
  });

  it("reverts to 'activo' when a payment is deleted below the total", async () => {
    const p = await seedPresupuesto(testDb, {
      totalAmount: 200,
      status: "finalizado",
    });
    const t1 = await seedTransaction(testDb, {
      amount: 200,
      category: "presupuesto",
      presupuestoId: p.id,
    });
    const res = await deleteTransactionAction(t1.id);
    expect(res.success).toBe(true);
    const row = await testDb.query.presupuestos.findFirst({
      where: eq(presupuestos.id, p.id),
    });
    expect(row?.status).toBe("activo");
  });
});

describe("deletePresupuestoAction", () => {
  it("deletes the presupuesto and orphans its transactions", async () => {
    const p = await seedPresupuesto(testDb);
    const t = await seedTransaction(testDb, {
      category: "presupuesto",
      presupuestoId: p.id,
    });
    const res = await deletePresupuestoAction(p.id);
    expect(res.success).toBe(true);

    const gone = await testDb.query.presupuestos.findFirst({
      where: eq(presupuestos.id, p.id),
    });
    expect(gone).toBeUndefined();

    const txn = await testDb.query.transactions.findFirst({
      where: eq(transactions.id, t.id),
    });
    expect(txn?.presupuestoId).toBeNull();
  });
});
