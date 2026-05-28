import { describe, expect, it } from "vitest";
import {
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
