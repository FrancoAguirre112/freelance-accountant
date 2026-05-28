import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatSafeDate,
  getQueryBounds,
  getSafeMonthsInRange,
  toMonthKey,
} from "@/lib/date-utils";

describe("getSafeMonthsInRange", () => {
  it("returns a single month for an intra-month range", () => {
    const months = getSafeMonthsInRange(
      new Date("2026-05-01T00:00:00Z"),
      new Date("2026-05-31T00:00:00Z"),
    );
    expect(months).toHaveLength(1);
    expect(months[0].id).toBe("2026-05");
    expect(months[0].label).toBe("Mayo 2026");
  });

  it("enumerates every month across a multi-month, cross-year range", () => {
    const months = getSafeMonthsInRange(
      new Date("2025-11-10T00:00:00Z"),
      new Date("2026-02-05T00:00:00Z"),
    );
    expect(months.map((m) => m.id)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("ignores timezone-shifted times on the input dates", () => {
    // Late-night UTC time must not bleed into the previous/next month.
    const months = getSafeMonthsInRange(
      new Date("2026-03-31T23:30:00Z"),
      new Date("2026-03-01T00:30:00Z"),
    );
    expect(months.map((m) => m.id)).toEqual(["2026-03"]);
  });

  it("capitalizes the Spanish month label", () => {
    const [m] = getSafeMonthsInRange(
      new Date("2026-01-15T00:00:00Z"),
      new Date("2026-01-20T00:00:00Z"),
    );
    expect(m.label).toBe("Enero 2026");
    expect(m.dateObj).toBeInstanceOf(Date);
  });
});

describe("toMonthKey", () => {
  it("returns the YYYY-MM prefix of the ISO string", () => {
    expect(toMonthKey(new Date(Date.UTC(2026, 0, 1)))).toBe("2026-01");
    expect(toMonthKey(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12");
  });
});

describe("formatSafeDate", () => {
  it("formats with the default dd/MM/yyyy mask", () => {
    expect(formatSafeDate(new Date("2026-01-05T03:00:00Z"))).toBe("05/01/2026");
  });

  it("does not shift the day for late-evening timestamps", () => {
    expect(formatSafeDate(new Date("2026-01-05T23:00:00Z"))).toBe("05/01/2026");
  });

  it("honors a custom format string", () => {
    expect(formatSafeDate(new Date("2026-07-09T00:00:00Z"), "yyyy-MM-dd")).toBe(
      "2026-07-09",
    );
  });

  it("does not mutate the input date", () => {
    const input = new Date("2026-07-09T00:00:00Z");
    const before = input.getTime();
    formatSafeDate(input);
    expect(input.getTime()).toBe(before);
  });
});

describe("getQueryBounds", () => {
  it("builds UTC start/end bounds from explicit params", () => {
    const { start, end } = getQueryBounds("2026-03-01", "2026-03-31");
    expect(start.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-31T23:59:59.999Z");
  });

  describe("with no params", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-18T10:00:00Z"));
    });
    afterEach(() => vi.useRealTimers());

    it("defaults to the current month boundaries", () => {
      const { start, end } = getQueryBounds(undefined, undefined);
      expect(start.toISOString()).toBe("2026-05-01T00:00:00.000Z");
      expect(end.toISOString()).toBe("2026-05-31T23:59:59.999Z");
    });

    it("mixes an explicit start with a defaulted end", () => {
      const { start, end } = getQueryBounds("2026-02-10", undefined);
      expect(start.toISOString()).toBe("2026-02-10T00:00:00.000Z");
      expect(end.toISOString()).toBe("2026-05-31T23:59:59.999Z");
    });
  });
});
