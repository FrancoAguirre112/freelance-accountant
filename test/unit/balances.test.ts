import { describe, expect, it } from "vitest";
import { computeOutstandingPerClient } from "@/lib/balances";

const p = (
  id: number,
  clientId: number | null,
  type: "ingreso" | "egreso",
  totalAmount: number,
  txAmounts: number[],
) => ({
  id,
  clientId,
  type,
  totalAmount,
  transactions: txAmounts.map((amount) => ({ amount })),
});

describe("computeOutstandingPerClient", () => {
  it("ignores ingreso presupuestos", () => {
    const map = computeOutstandingPerClient([p(1, 7, "ingreso", 1000, [200])]);
    expect(map.size).toBe(0);
  });

  it("sums owed and paid across multiple egreso presupuestos per client", () => {
    const map = computeOutstandingPerClient([
      p(1, 7, "egreso", 500, [-200]),
      p(2, 7, "egreso", 300, [-300]),
      p(3, 9, "egreso", 100, []),
    ]);
    expect(map.get(7)).toEqual({
      clientId: 7,
      totalOwed: 800,
      totalPaid: 500,
      outstanding: 300,
    });
    expect(map.get(9)).toEqual({
      clientId: 9,
      totalOwed: 100,
      totalPaid: 0,
      outstanding: 100,
    });
  });

  it("clamps outstanding at zero when overpaid", () => {
    const map = computeOutstandingPerClient([
      p(1, 7, "egreso", 100, [-150]),
    ]);
    expect(map.get(7)?.outstanding).toBe(0);
  });

  it("ignores egreso presupuestos with no clientId", () => {
    const map = computeOutstandingPerClient([p(1, null, "egreso", 100, [])]);
    expect(map.size).toBe(0);
  });

  it("uses absolute values for both totals and payments", () => {
    const map = computeOutstandingPerClient([
      p(1, 7, "egreso", -500, [-100, 50]),
    ]);
    expect(map.get(7)).toMatchObject({ totalOwed: 500, totalPaid: 150 });
  });
});
