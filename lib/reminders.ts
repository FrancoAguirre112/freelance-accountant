// Pure helpers for the recurring-payments Slack reminder.
//
// "Due today" rule (kept intentionally simple): a recurring service is due
// today if all of the following hold —
//   1. `today` falls inside the service's lifecycle (startDate / endDate).
//   2. `today.getUTCDate() === service.billingDay`.
//   3. The service has no `recurring` transaction with an imputedDate (or
//      date, if imputed is null) in the same calendar month as today.
//
// The cron route runs once per day; the rule fires once per cycle per
// service (the day's transactions cover the month immediately after).
import { isServiceActiveInRange } from "./recurring";

export interface ReminderService {
  id: number;
  name: string;
  amount: number;
  billingDay: number;
  startDate: Date;
  endDate: Date | null;
  type: "service" | "payment";
  client?: { name: string } | null;
}

export interface ReminderTransaction {
  serviceId: number | null;
  category: string | null;
  date: Date;
  imputedDate: Date | null;
}

export interface DueReminder {
  serviceId: number;
  serviceName: string;
  amount: number;
  type: "service" | "payment";
  clientName: string;
  billingDay: number;
}

function sameMonth(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth()
  );
}

export function findDueReminders(
  services: ReminderService[],
  transactions: ReminderTransaction[],
  today: Date,
): DueReminder[] {
  const todayDom = today.getUTCDate();
  // Active-lifecycle filter: the single-day "range" is today → today.
  return services
    .filter((s) => isServiceActiveInRange(s, today, today))
    .filter((s) => s.billingDay === todayDom)
    .filter((s) => {
      const paidThisMonth = transactions.some(
        (t) =>
          t.serviceId === s.id &&
          t.category === "recurring" &&
          sameMonth(t.imputedDate ?? t.date, today),
      );
      return !paidThisMonth;
    })
    .map((s) => ({
      serviceId: s.id,
      serviceName: s.name,
      amount: s.amount,
      type: s.type,
      clientName: s.client?.name ?? "Sin Entidad",
      billingDay: s.billingDay,
    }));
}

/**
 * Renders the Slack message payload (Block Kit) for a non-empty due list.
 */
export function buildSlackMessage(
  dueList: DueReminder[],
  today: Date,
): { text: string; blocks: unknown[] } {
  const fmtDate = today.toISOString().slice(0, 10);
  const fmtAmount = (n: number) =>
    n.toLocaleString("es-AR", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  const fallback = `Fiscus — recordatorios del ${fmtDate} (${dueList.length})`;
  const lines = dueList.map(
    (d) =>
      `• ${d.type === "payment" ? "💸" : "💰"} *${d.serviceName}* — ${d.clientName} · ${fmtAmount(d.amount)}`,
  );
  return {
    text: fallback,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "Fiscus — recordatorios de hoy" },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Hoy *${fmtDate}* — ${dueList.length} recurrente${dueList.length === 1 ? "" : "s"} pendiente${dueList.length === 1 ? "" : "s"}:\n${lines.join("\n")}`,
        },
      },
    ],
  };
}
