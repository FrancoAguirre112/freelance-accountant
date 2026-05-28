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
  createClientAction,
  getOutstandingPerEntityAction,
  updateClientAction,
} from "@/app/actions";
import { clients } from "@/db/schema";
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

describe("client kind", () => {
  it("defaults new clients to 'customer'", async () => {
    const res = await createClientAction({ name: "X" });
    const row = await testDb.query.clients.findFirst({
      where: eq(clients.id, res.id),
    });
    expect(row?.kind).toBe("customer");
  });

  it("accepts a collaborator kind on create and update", async () => {
    const res = await createClientAction({
      name: "Programador",
      kind: "collaborator",
    });
    let row = await testDb.query.clients.findFirst({
      where: eq(clients.id, res.id),
    });
    expect(row?.kind).toBe("collaborator");

    await updateClientAction(res.id, { kind: "vendor" });
    row = await testDb.query.clients.findFirst({
      where: eq(clients.id, res.id),
    });
    expect(row?.kind).toBe("vendor");
  });
});

describe("getOutstandingPerEntityAction", () => {
  it("aggregates owed/paid/outstanding across egreso presupuestos", async () => {
    const programmer = await seedClient(testDb, {
      name: "Programador",
      kind: "collaborator",
    });
    const customer = await seedClient(testDb, { name: "Cliente" });

    const p1 = await seedPresupuesto(testDb, {
      clientId: programmer.id,
      type: "egreso",
      totalAmount: 800,
    });
    await seedPresupuesto(testDb, {
      clientId: programmer.id,
      type: "egreso",
      totalAmount: 200,
    });
    await seedPresupuesto(testDb, {
      clientId: customer.id,
      type: "ingreso",
      totalAmount: 5000,
    });
    await seedTransaction(testDb, {
      presupuestoId: p1.id,
      category: "presupuesto",
      amount: -300,
    });

    const all = await getOutstandingPerEntityAction();
    const prog = all.find((r) => r.clientId === programmer.id);
    expect(prog).toMatchObject({
      clientName: "Programador",
      kind: "collaborator",
      totalOwed: 1000,
      totalPaid: 300,
      outstanding: 700,
    });
    // Customer has no egreso → excluded
    expect(all.find((r) => r.clientId === customer.id)).toBeUndefined();
  });

  it("filters by kind", async () => {
    const collab = await seedClient(testDb, {
      name: "Programador",
      kind: "collaborator",
    });
    const vendor = await seedClient(testDb, {
      name: "Hosting Co",
      kind: "vendor",
    });
    await seedPresupuesto(testDb, { clientId: collab.id, type: "egreso", totalAmount: 100 });
    await seedPresupuesto(testDb, { clientId: vendor.id, type: "egreso", totalAmount: 50 });

    const collabs = await getOutstandingPerEntityAction({ kind: "collaborator" });
    expect(collabs.map((r) => r.clientName)).toEqual(["Programador"]);
  });
});
