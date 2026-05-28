import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { vi } from "vitest";

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
  deleteClientAction,
  updateClientAction,
} from "@/app/actions";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  applyDDL,
  resetDb,
  setAuthUser,
  testDb,
} from "../helpers/integration-db";
import {
  OTHER_USER_ID,
  TEST_USER_ID,
  seedClient,
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

describe("createClientAction", () => {
  it("creates a user-scoped client and returns its id", async () => {
    const res = await createClientAction({ name: "Mermoz", status: "active" });
    expect(res.success).toBe(true);
    const row = await testDb.query.clients.findFirst({
      where: eq(clients.id, res.id),
    });
    expect(row).toMatchObject({ name: "Mermoz", userId: TEST_USER_ID });
  });

  it("throws when unauthenticated", async () => {
    setAuthUser(null);
    await expect(createClientAction({ name: "X" })).rejects.toThrow(
      "Not authenticated",
    );
  });
});

describe("updateClientAction", () => {
  it("updates a client owned by the user", async () => {
    const c = await seedClient(testDb, { name: "Old" });
    const res = await updateClientAction(c.id, { name: "New" });
    expect(res.success).toBe(true);
    const row = await testDb.query.clients.findFirst({
      where: eq(clients.id, c.id),
    });
    expect(row?.name).toBe("New");
  });

  it("does not modify another user's client", async () => {
    await seedUser(testDb, OTHER_USER_ID);
    const c = await seedClient(testDb, { name: "Theirs", userId: OTHER_USER_ID });
    await updateClientAction(c.id, { name: "Hacked" });
    const row = await testDb.query.clients.findFirst({
      where: eq(clients.id, c.id),
    });
    expect(row?.name).toBe("Theirs");
  });
});

describe("deleteClientAction", () => {
  it("deletes a client with no links", async () => {
    const c = await seedClient(testDb);
    const res = await deleteClientAction(c.id);
    expect(res.success).toBe(true);
    const row = await testDb.query.clients.findFirst({
      where: eq(clients.id, c.id),
    });
    expect(row).toBeUndefined();
  });

  it("refuses to delete when a presupuesto is linked", async () => {
    const c = await seedClient(testDb);
    await seedPresupuesto(testDb, { clientId: c.id });
    const res = await deleteClientAction(c.id);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/presupuestos o servicios vinculados/);
  });

  it("refuses to delete when a recurring service is linked", async () => {
    const c = await seedClient(testDb);
    await seedRecurring(testDb, { clientId: c.id });
    const res = await deleteClientAction(c.id);
    expect(res.success).toBe(false);
  });
});
