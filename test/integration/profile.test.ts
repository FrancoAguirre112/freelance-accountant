import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const m = await import("../helpers/integration-db");
  return { db: m.testDb };
});
vi.mock("@/auth", async () => {
  const m = await import("../helpers/integration-db");
  return { auth: () => m.getMockSession() };
});

import { setProfileTypeAction } from "@/app/actions";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { applyDDL, resetDb, setAuthUser, testDb } from "../helpers/integration-db";
import { TEST_USER_ID, seedUser } from "../helpers/factories";

beforeAll(async () => {
  await applyDDL();
});
beforeEach(async () => {
  await resetDb();
  setAuthUser(TEST_USER_ID);
});

describe("setProfileTypeAction", () => {
  it("persists the chosen profile type for the session user", async () => {
    await seedUser(testDb, TEST_USER_ID, null);
    const res = await setProfileTypeAction("marketing");
    expect(res.success).toBe(true);
    const row = await testDb.query.users.findFirst({
      where: eq(users.id, TEST_USER_ID),
    });
    expect(row?.profileType).toBe("marketing");
  });

  it("throws when unauthenticated", async () => {
    setAuthUser(null);
    await expect(setProfileTypeAction("programador")).rejects.toThrow(
      "Not authenticated",
    );
  });
});
