import { describe, expect, it } from "vitest";
import {
  coverageAmount,
  isMonthCovered,
  isMonthPartiallyPaid,
  isServiceActiveInMonth,
  isServiceActiveInRange,
} from "@/lib/recurring";

const d = (s: string) => new Date(s);

describe("isServiceActiveInRange", () => {
  it("includes a service whose lifecycle fully covers the range", () => {
    expect(
      isServiceActiveInRange(
        { startDate: d("2026-01-01"), endDate: null },
        d("2026-03-01"),
        d("2026-04-01"),
      ),
    ).toBe(true);
  });

  it("excludes a service that ended before the range starts", () => {
    expect(
      isServiceActiveInRange(
        { startDate: d("2026-01-01"), endDate: d("2026-02-15") },
        d("2026-03-01"),
        d("2026-04-01"),
      ),
    ).toBe(false);
  });

  it("excludes a service that starts after the range ends", () => {
    expect(
      isServiceActiveInRange(
        { startDate: d("2026-06-01"), endDate: null },
        d("2026-03-01"),
        d("2026-04-01"),
      ),
    ).toBe(false);
  });

  it("includes a service whose end overlaps the start of the range", () => {
    expect(
      isServiceActiveInRange(
        { startDate: d("2026-01-01"), endDate: d("2026-03-15") },
        d("2026-03-01"),
        d("2026-04-01"),
      ),
    ).toBe(true);
  });

  it("treats a missing endDate as ongoing forever", () => {
    expect(
      isServiceActiveInRange(
        { startDate: d("2020-01-01") },
        d("2100-01-01"),
        d("2100-12-31"),
      ),
    ).toBe(true);
  });
});

describe("isServiceActiveInMonth", () => {
  it("returns true for a month inside the lifecycle", () => {
    expect(
      isServiceActiveInMonth(
        { startDate: d("2026-01-01"), endDate: d("2026-06-30") },
        "2026-03",
      ),
    ).toBe(true);
  });

  it("returns false for a month before startDate", () => {
    expect(
      isServiceActiveInMonth({ startDate: d("2026-03-01") }, "2026-02"),
    ).toBe(false);
  });

  it("returns false for a month after endDate", () => {
    expect(
      isServiceActiveInMonth(
        { startDate: d("2026-01-01"), endDate: d("2026-03-15") },
        "2026-04",
      ),
    ).toBe(false);
  });

  it("returns true for the month containing endDate", () => {
    expect(
      isServiceActiveInMonth(
        { startDate: d("2026-01-01"), endDate: d("2026-03-15") },
        "2026-03",
      ),
    ).toBe(true);
  });
});

describe("coverageAmount", () => {
  it("returns the raw amount for income services", () => {
    expect(coverageAmount("service", 80)).toBe(80);
    expect(coverageAmount("service", 0)).toBe(0);
  });

  it("flips the sign for payment services so negative rows are positive coverage", () => {
    expect(coverageAmount("payment", -100)).toBe(100);
    expect(coverageAmount("payment", -50)).toBe(50);
  });

  it("treats a positive payment row as negative coverage (refund net-out)", () => {
    // raw sum on payment service: -100 + 100 = 0  → effective 0 → not covered
    expect(coverageAmount("payment", 0)).toBe(-0);
    // raw sum on payment service: +100 alone → effective -100 → not covered
    expect(coverageAmount("payment", 100)).toBe(-100);
  });
});

describe("isMonthCovered", () => {
  it("is true when a payment service has exactly one negative monthly fee", () => {
    expect(isMonthCovered("payment", -100, 100)).toBe(true);
  });

  it("is false when a payment service has a refund cancelling the payment", () => {
    expect(isMonthCovered("payment", 0, 100)).toBe(false);
  });

  it("is true when an income service has been fully cobrado", () => {
    expect(isMonthCovered("service", 100, 100)).toBe(true);
    expect(isMonthCovered("service", 150, 100)).toBe(true);
  });

  it("is false when income coverage is short", () => {
    expect(isMonthCovered("service", 50, 100)).toBe(false);
  });

  it("treats the monthly fee as an absolute target", () => {
    // even if someone stored monthlyFee as negative, we compare against |fee|
    expect(isMonthCovered("payment", -100, -100)).toBe(true);
  });
});

describe("isMonthPartiallyPaid", () => {
  it("returns true for a partial income payment", () => {
    expect(isMonthPartiallyPaid("service", 50, 100)).toBe(true);
  });

  it("returns true for a partial payment-service payment", () => {
    expect(isMonthPartiallyPaid("payment", -50, 100)).toBe(true);
  });

  it("returns false at zero", () => {
    expect(isMonthPartiallyPaid("service", 0, 100)).toBe(false);
    expect(isMonthPartiallyPaid("payment", 0, 100)).toBe(false);
  });

  it("returns false when fully covered", () => {
    expect(isMonthPartiallyPaid("payment", -100, 100)).toBe(false);
    expect(isMonthPartiallyPaid("service", 100, 100)).toBe(false);
  });
});
