// Pure helpers for the recurring-payments Slack reminder.
//
// "Due today" rule (paid-in-arrears): a recurring service is due today if
// all of the following hold —
//   1. `today` falls inside the service's lifecycle (startDate / endDate).
//   2. `today.getUTCDate() === service.billingDay`.
//   3. The service has no `recurring` transaction whose imputedDate (or
//      date, if imputed is null) is in the PREVIOUS calendar month. The
//      billing day is when payment is expected FOR the prior month's
//      cycle, matching the imputedDate default applied at create time.
//
// The cron route runs once per day; the rule fires once per cycle per
// service.
import { subMonths } from "date-fns";
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
  // The cycle expected to be paid TODAY belongs to last month under the
  // arrears convention. Reminder fires if no transaction is imputed to
  // that previous month yet.
  const previousMonth = subMonths(today, 1);
  return services
    .filter((s) => isServiceActiveInRange(s, today, today))
    .filter((s) => s.billingDay === todayDom)
    .filter((s) => {
      const paidForLastMonth = transactions.some(
        (t) =>
          t.serviceId === s.id &&
          t.category === "recurring" &&
          sameMonth(t.imputedDate ?? t.date, previousMonth),
      );
      return !paidForLastMonth;
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
