import { describe, expect, it } from "vitest";
import {
  buildSlackMessage,
  findDueReminders,
  type ReminderService,
  type ReminderTransaction,
} from "@/lib/reminders";

const svc = (overrides: Partial<ReminderService> = {}): ReminderService => ({
  id: overrides.id ?? 1,
  name: overrides.name ?? "Hosting",
  amount: overrides.amount ?? 15,
  billingDay: overrides.billingDay ?? 5,
  startDate: overrides.startDate ?? new Date("2026-01-01"),
  endDate: overrides.endDate ?? null,
  type: overrides.type ?? "payment",
  client: "client" in overrides ? overrides.client : { name: "Acme" },
});

const txn = (overrides: Partial<ReminderTransaction> = {}): ReminderTransaction => ({
  serviceId: overrides.serviceId ?? 1,
  category: overrides.category ?? "recurring",
  date: overrides.date ?? new Date("2026-05-05T12:00:00Z"),
  imputedDate: overrides.imputedDate ?? null,
});

describe("findDueReminders", () => {
  const today = new Date("2026-05-05T12:00:00Z");

  it("returns nothing when no services exist", () => {
    expect(findDueReminders([], [], today)).toEqual([]);
  });

  it("includes a service whose billingDay matches today and last month is unpaid", () => {
    const due = findDueReminders([svc()], [], today);
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({
      serviceId: 1,
      serviceName: "Hosting",
      clientName: "Acme",
      amount: 15,
      type: "payment",
    });
  });

  it("excludes a service whose billingDay is not today", () => {
    expect(
      findDueReminders([svc({ billingDay: 1 })], [], today),
    ).toEqual([]);
  });

  it("excludes a service whose previous month was already paid (arrears)", () => {
    // today=May 5 → reminder asks 'is April paid?'. A transaction imputed
    // to April should satisfy it.
    const paid = txn({
      date: new Date("2026-05-04T12:00:00Z"),
      imputedDate: new Date("2026-04-04T12:00:00Z"),
    });
    expect(findDueReminders([svc()], [paid], today)).toEqual([]);
  });

  it("does NOT count a current-month-imputed payment toward last month", () => {
    // A transaction imputed to MAY does not satisfy the reminder firing on
    // May 5 — that reminder is asking about April under arrears.
    const paid = txn({
      date: new Date("2026-05-02T12:00:00Z"),
      imputedDate: new Date("2026-05-02T12:00:00Z"),
    });
    expect(findDueReminders([svc()], [paid], today)).toHaveLength(1);
  });

  it("uses imputedDate over date when both are present", () => {
    const paid = txn({
      date: new Date("2026-05-30T12:00:00Z"),
      imputedDate: new Date("2026-04-15T12:00:00Z"),
    });
    expect(findDueReminders([svc()], [paid], today)).toEqual([]);
  });

  it("ignores non-recurring transactions", () => {
    const other = txn({ category: "other" });
    expect(findDueReminders([svc()], [other], today)).toHaveLength(1);
  });

  it("excludes a service that ended before today", () => {
    expect(
      findDueReminders(
        [svc({ endDate: new Date("2026-04-30T12:00:00Z") })],
        [],
        today,
      ),
    ).toEqual([]);
  });

  it("excludes a service that hasn't started yet", () => {
    expect(
      findDueReminders(
        [svc({ startDate: new Date("2027-01-01T12:00:00Z") })],
        [],
        today,
      ),
    ).toEqual([]);
  });

  it("falls back the client name when none is linked", () => {
    const due = findDueReminders([svc({ client: null })], [], today);
    expect(due[0].clientName).toBe("Sin Entidad");
  });
});

describe("buildSlackMessage", () => {
  it("produces a single-line summary for one due item", () => {
    const today = new Date("2026-05-05T12:00:00Z");
    const msg = buildSlackMessage(
      [
        {
          serviceId: 1,
          serviceName: "Hosting",
          amount: 15,
          type: "payment",
          clientName: "Acme",
          billingDay: 5,
        },
      ],
      today,
    );
    expect(msg.text).toMatch(/2026-05-05/);
    expect(msg.text).toMatch(/\(1\)/);
    expect(JSON.stringify(msg.blocks)).toContain("Hosting");
    expect(JSON.stringify(msg.blocks)).toContain("Acme");
  });

  it("pluralizes for multiple due items", () => {
    const today = new Date("2026-05-05T12:00:00Z");
    const msg = buildSlackMessage(
      [
        { serviceId: 1, serviceName: "A", amount: 1, type: "service", clientName: "X", billingDay: 5 },
        { serviceId: 2, serviceName: "B", amount: 2, type: "payment", clientName: "Y", billingDay: 5 },
      ],
      today,
    );
    expect(JSON.stringify(msg.blocks)).toMatch(/pendientes/);
  });
});
