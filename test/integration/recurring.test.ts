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
  createRecurringFromPresupuestoAction,
  createRecurringServiceAction,
  deleteRecurringServiceAction,
  getRecurringCoverageAction,
  updateRecurringServiceAction,
} from "@/app/actions";
import { recurringServices, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { applyDDL, resetDb, setAuthUser, testDb } from "../helpers/integration-db";
import {
  TEST_USER_ID,
  seedClient,
  seedRecurring,
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

describe("createRecurringServiceAction", () => {
  it("defaults type to 'service' and billingDay to 1", async () => {
    const c = await seedClient(testDb);
    await createRecurringServiceAction({ name: "Maint", clientId: c.id, amount: 50 });
    const row = await testDb.query.recurringServices.findFirst({
      where: eq(recurringServices.name, "Maint"),
    });
    expect(row).toMatchObject({ type: "service", billingDay: 1, amount: 50 });
  });
});

describe("createRecurringFromPresupuestoAction", () => {
  it("creates a 'payment' recurring service", async () => {
    const c = await seedClient(testDb);
    await createRecurringFromPresupuestoAction({
      name: "Retainer",
      clientId: c.id,
      amount: 200,
    });
    const row = await testDb.query.recurringServices.findFirst({
      where: eq(recurringServices.name, "Retainer"),
    });
    expect(row?.type).toBe("payment");
  });
});

describe("updateRecurringServiceAction", () => {
  it("updates the monthly amount", async () => {
    const s = await seedRecurring(testDb, { amount: 50 });
    await updateRecurringServiceAction(s.id, { amount: 75 });
    const row = await testDb.query.recurringServices.findFirst({
      where: eq(recurringServices.id, s.id),
    });
    expect(row?.amount).toBe(75);
  });
});

describe("deleteRecurringServiceAction", () => {
  it("deletes the service and orphans linked transactions", async () => {
    const s = await seedRecurring(testDb);
    const t = await seedTransaction(testDb, {
      category: "recurring",
      serviceId: s.id,
    });
    const res = await deleteRecurringServiceAction(s.id);
    expect(res.success).toBe(true);

    const gone = await testDb.query.recurringServices.findFirst({
      where: eq(recurringServices.id, s.id),
    });
    expect(gone).toBeUndefined();
    const txn = await testDb.query.transactions.findFirst({
      where: eq(transactions.id, t.id),
    });
    expect(txn?.serviceId).toBeNull();
  });
});

describe("getRecurringCoverageAction", () => {
  it("aggregates payments by month and falls back the client name", async () => {
    const s = await seedRecurring(testDb, {
      name: "Hosting",
      amount: 15,
      clientId: undefined,
    });
    await seedTransaction(testDb, {
      category: "recurring",
      serviceId: s.id,
      amount: 15,
      date: new Date("2026-01-10T12:00:00Z"),
    });
    await seedTransaction(testDb, {
      category: "recurring",
      serviceId: s.id,
      amount: 15,
      date: new Date("2026-02-10T12:00:00Z"),
    });
    // out-of-range / non-recurring rows must be ignored
    await seedTransaction(testDb, {
      category: "other",
      serviceId: s.id,
      amount: 999,
      date: new Date("2026-02-15T12:00:00Z"),
    });

    const result = await getRecurringCoverageAction(
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-03-31T00:00:00Z"),
    );

    const cov = result.find((r) => r.serviceId === s.id)!;
    expect(cov.serviceName).toBe("Hosting");
    expect(cov.clientName).toBe("Sin Entidad");
    expect(cov.totalCollected).toBe(30);
    expect(cov.paymentsByMonth).toEqual({ "2026-01": 15, "2026-02": 15 });
  });

  it("keys a payment by its imputedDate, not its real date", async () => {
    const s = await seedRecurring(testDb, { name: "Svc" });
    await seedTransaction(testDb, {
      category: "recurring",
      serviceId: s.id,
      amount: 40,
      date: new Date("2026-04-28T12:00:00Z"),
      imputedDate: new Date("2026-05-01T12:00:00Z"),
    });

    const result = await getRecurringCoverageAction(
      new Date("2026-04-01T00:00:00Z"),
      new Date("2026-04-30T00:00:00Z"),
    );
    const cov = result.find((r) => r.serviceId === s.id)!;
    expect(cov.paymentsByMonth).toEqual({ "2026-05": 40 });
  });

  it("excludes a service that ended before the queried range", async () => {
    await seedRecurring(testDb, {
      name: "Past client",
      startDate: new Date("2025-01-01T12:00:00Z"),
      endDate: new Date("2025-12-31T12:00:00Z"),
    });
    const ongoing = await seedRecurring(testDb, { name: "Ongoing" });

    const result = await getRecurringCoverageAction(
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-03-31T00:00:00Z"),
    );
    expect(result.map((r) => r.serviceName)).toEqual(["Ongoing"]);
    expect(result[0].serviceId).toBe(ongoing.id);
  });

  it("excludes a service that starts after the queried range", async () => {
    await seedRecurring(testDb, {
      name: "Future",
      startDate: new Date("2027-01-01T12:00:00Z"),
    });
    await seedRecurring(testDb, { name: "Now" });

    const result = await getRecurringCoverageAction(
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-03-31T00:00:00Z"),
    );
    expect(result.map((r) => r.serviceName)).toEqual(["Now"]);
  });

  it("includes a service whose end date is mid-range", async () => {
    await seedRecurring(testDb, {
      name: "Ended mid-range",
      startDate: new Date("2026-01-01T12:00:00Z"),
      endDate: new Date("2026-03-15T12:00:00Z"),
    });
    const result = await getRecurringCoverageAction(
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-03-31T00:00:00Z"),
    );
    expect(result.map((r) => r.serviceName)).toEqual(["Ended mid-range"]);
  });
});
