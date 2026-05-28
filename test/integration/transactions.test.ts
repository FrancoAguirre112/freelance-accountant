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
  createTransactionAction,
  importTransactionsAction,
  updateTransactionAction,
} from "@/app/actions";
import { transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { applyDDL, resetDb, setAuthUser, testDb } from "../helpers/integration-db";
import {
  TEST_USER_ID,
  seedPresupuesto,
  seedRecurring,
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

describe("createTransactionAction", () => {
  it("stores a plain 'other' transaction with the session user", async () => {
    await createTransactionAction({
      date: new Date("2026-03-01T12:00:00Z"),
      amount: 100,
      category: "other",
      description: "Misc",
    });
    const row = await testDb.query.transactions.findFirst({
      where: eq(transactions.description, "Misc"),
    });
    expect(row).toMatchObject({ amount: 100, userId: TEST_USER_ID });
  });

  it("auto-negates a positive amount for an egreso presupuesto", async () => {
    const p = await seedPresupuesto(testDb, { type: "egreso", totalAmount: -500 });
    await createTransactionAction({
      date: new Date("2026-03-01T12:00:00Z"),
      amount: 120,
      category: "presupuesto",
      presupuestoId: p.id,
    });
    const row = await testDb.query.transactions.findFirst({
      where: eq(transactions.presupuestoId, p.id),
    });
    expect(row?.amount).toBe(-120);
  });

  it("auto-negates a positive amount for a payment-type recurring service", async () => {
    const svc = await seedRecurring(testDb, { type: "payment", amount: 100 });
    await createTransactionAction({
      date: new Date("2026-05-01T12:00:00Z"),
      amount: 100,
      category: "recurring",
      serviceId: svc.id,
    });
    const row = await testDb.query.transactions.findFirst({
      where: eq(transactions.serviceId, svc.id),
    });
    expect(row?.amount).toBe(-100);
  });

  it("leaves ingreso recurring service amounts positive", async () => {
    const svc = await seedRecurring(testDb, { type: "service", amount: 50 });
    await createTransactionAction({
      date: new Date("2026-05-01T12:00:00Z"),
      amount: 50,
      category: "recurring",
      serviceId: svc.id,
    });
    const row = await testDb.query.transactions.findFirst({
      where: eq(transactions.serviceId, svc.id),
    });
    expect(row?.amount).toBe(50);
  });

  it("defaults imputedDate to (date − 1 month) for recurring transactions", async () => {
    const svc = await seedRecurring(testDb, { type: "service", amount: 200 });
    await createTransactionAction({
      date: new Date("2026-05-04T12:00:00Z"),
      amount: 200,
      category: "recurring",
      serviceId: svc.id,
    });
    const row = await testDb.query.transactions.findFirst({
      where: eq(transactions.serviceId, svc.id),
    });
    expect(row?.imputedDate?.toISOString().slice(0, 7)).toBe("2026-04");
  });

  it("respects an explicit imputedDate even for recurring transactions", async () => {
    const svc = await seedRecurring(testDb, { type: "service", amount: 200 });
    await createTransactionAction({
      date: new Date("2026-05-04T12:00:00Z"),
      imputedDate: new Date("2026-05-04T12:00:00Z"),
      amount: 200,
      category: "recurring",
      serviceId: svc.id,
    });
    const row = await testDb.query.transactions.findFirst({
      where: eq(transactions.serviceId, svc.id),
    });
    expect(row?.imputedDate?.toISOString().slice(0, 7)).toBe("2026-05");
  });

  it("does NOT shift imputedDate for non-recurring transactions", async () => {
    await createTransactionAction({
      date: new Date("2026-05-04T12:00:00Z"),
      amount: 10,
      category: "other",
      description: "misc",
    });
    const row = await testDb.query.transactions.findFirst({
      where: eq(transactions.description, "misc"),
    });
    expect(row?.imputedDate).toBeNull();
  });

  it("leaves ingreso presupuesto amounts positive", async () => {
    const p = await seedPresupuesto(testDb, { type: "ingreso" });
    await createTransactionAction({
      date: new Date("2026-03-01T12:00:00Z"),
      amount: 80,
      category: "presupuesto",
      presupuestoId: p.id,
    });
    const row = await testDb.query.transactions.findFirst({
      where: eq(transactions.presupuestoId, p.id),
    });
    expect(row?.amount).toBe(80);
  });
});

describe("updateTransactionAction", () => {
  it("patches an existing transaction", async () => {
    await createTransactionAction({
      date: new Date("2026-03-01T12:00:00Z"),
      amount: 10,
      category: "other",
      description: "before",
    });
    const created = await testDb.query.transactions.findFirst({
      where: eq(transactions.description, "before"),
    });
    await updateTransactionAction(created!.id, { description: "after", amount: 99 });
    const row = await testDb.query.transactions.findFirst({
      where: eq(transactions.id, created!.id),
    });
    expect(row).toMatchObject({ description: "after", amount: 99 });
  });
});

describe("importTransactionsAction", () => {
  it("bulk inserts transactions for the user", async () => {
    const res = await importTransactionsAction([
      {
        date: new Date("2026-01-01T12:00:00Z"),
        amount: 1,
        category: "other",
        description: "a",
      },
      {
        date: new Date("2026-02-01T12:00:00Z"),
        amount: 2,
        category: "other",
        description: "b",
      },
    ]);
    expect(res.success).toBe(true);
    const rows = await testDb.query.transactions.findMany();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.userId === TEST_USER_ID)).toBe(true);
  });

  it("returns a failure object when unauthenticated", async () => {
    setAuthUser(null);
    const res = await importTransactionsAction([
      {
        date: new Date("2026-01-01T12:00:00Z"),
        amount: 1,
        category: "other",
      },
    ]);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });
});
