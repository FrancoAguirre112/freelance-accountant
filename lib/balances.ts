// Pure aggregation helpers — used by the dashboard + the server action +
// the MCP tool so the same math runs in every surface.

export interface PresupuestoLike {
  id: number;
  clientId: number | null;
  type: "ingreso" | "egreso";
  totalAmount: number;
  transactions: { amount: number }[];
}

export interface ClientOutstanding {
  clientId: number;
  totalOwed: number;
  totalPaid: number;
  outstanding: number;
}

/**
 * For every client referenced by an egreso presupuesto, aggregate:
 *   totalOwed  — sum of |totalAmount| across their egreso presupuestos
 *   totalPaid  — sum of |amount| across transactions on those presupuestos
 *   outstanding — max(0, owed - paid)
 *
 * Returned as a Map keyed by clientId for cheap lookup in UI rows.
 */
export function computeOutstandingPerClient(
  presupuestos: PresupuestoLike[],
): Map<number, ClientOutstanding> {
  const byClient = new Map<number, ClientOutstanding>();
  for (const p of presupuestos) {
    if (p.type !== "egreso" || p.clientId == null) continue;
    const entry = byClient.get(p.clientId) ?? {
      clientId: p.clientId,
      totalOwed: 0,
      totalPaid: 0,
      outstanding: 0,
    };
    entry.totalOwed += Math.abs(p.totalAmount);
    entry.totalPaid += p.transactions.reduce(
      (s, t) => s + Math.abs(t.amount),
      0,
    );
    entry.outstanding = Math.max(0, entry.totalOwed - entry.totalPaid);
    byClient.set(p.clientId, entry);
  }
  return byClient;
}
