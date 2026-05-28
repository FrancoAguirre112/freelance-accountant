import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const m = await import("../helpers/integration-db");
  return { db: m.testDb };
});
vi.mock("@/auth", async () => {
  const m = await import("../helpers/integration-db");
  return { auth: () => m.getMockSession() };
});

import {
  sendRecurringRemindersAction,
  setSlackWebhookAction,
} from "@/app/actions";
import { users } from "@/db/schema";
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
afterEach(() => vi.restoreAllMocks());

describe("setSlackWebhookAction", () => {
  it("saves a trimmed URL on the current user", async () => {
    const res = await setSlackWebhookAction(
      "  https://hooks.slack.com/services/abc  ",
    );
    expect(res.success).toBe(true);
    const u = await testDb.query.users.findFirst({
      where: eq(users.id, TEST_USER_ID),
    });
    expect(u?.slackWebhookUrl).toBe("https://hooks.slack.com/services/abc");
  });

  it("nulls the value when an empty string or null is passed", async () => {
    await setSlackWebhookAction("https://hooks.slack.com/services/abc");
    await setSlackWebhookAction(null);
    const u = await testDb.query.users.findFirst({
      where: eq(users.id, TEST_USER_ID),
    });
    expect(u?.slackWebhookUrl).toBeNull();
  });
});

describe("sendRecurringRemindersAction", () => {
  it("returns no_webhook_configured when the user has none set", async () => {
    const res = await sendRecurringRemindersAction({
      today: new Date("2026-05-05T12:00:00Z"),
    });
    expect(res).toMatchObject({ sent: false, reason: "no_webhook_configured" });
  });

  it("returns nothing_due when nothing matches today", async () => {
    await setSlackWebhookAction("https://hooks.slack.com/services/x");
    await seedRecurring(testDb, { billingDay: 1 });
    const res = await sendRecurringRemindersAction({
      today: new Date("2026-05-05T12:00:00Z"),
    });
    expect(res).toMatchObject({ sent: false, reason: "nothing_due" });
  });

  it("posts to Slack and returns sent=true when a service is due", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response("ok", { status: 200, statusText: "OK" }),
      );

    await setSlackWebhookAction("https://hooks.slack.com/services/x");
    const client = await seedClient(testDb, { name: "Proveedor X" });
    await seedRecurring(testDb, {
      name: "Hosting",
      clientId: client.id,
      billingDay: 5,
      amount: 25,
    });

    const today = new Date("2026-05-05T12:00:00Z");
    const res = await sendRecurringRemindersAction({ today });
    expect(res.sent).toBe(true);
    expect(res.due).toHaveLength(1);
    expect(res.due[0].serviceName).toBe("Hosting");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hooks.slack.com/services/x");
    const body = JSON.parse(init.body as string);
    expect(body.text).toMatch(/2026-05-05/);
    expect(JSON.stringify(body.blocks)).toContain("Hosting");
  });

  it("skips a service when last month's cycle is already paid (arrears)", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));

    await setSlackWebhookAction("https://hooks.slack.com/services/x");
    const s = await seedRecurring(testDb, { billingDay: 5 });
    // Paid May 3, imputed to April → satisfies the May 5 arrears reminder.
    await seedTransaction(testDb, {
      category: "recurring",
      serviceId: s.id,
      date: new Date("2026-05-03T12:00:00Z"),
      imputedDate: new Date("2026-04-03T12:00:00Z"),
    });

    const res = await sendRecurringRemindersAction({
      today: new Date("2026-05-05T12:00:00Z"),
    });
    expect(res).toMatchObject({ sent: false, reason: "nothing_due" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
