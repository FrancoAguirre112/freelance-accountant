"use server";

import { db } from "@/db";
import {
  clients,
  presupuestos,
  transactions,
  recurringServices,
  users,
} from "@/db/schema";
import { auth } from "@/auth";
import { getTestSession, isE2E } from "@/lib/test-auth";
import { revalidatePath } from "next/cache";
import { type InferInsertModel, eq, and, between } from "drizzle-orm";
import {
  buildSlackMessage,
  findDueReminders,
  type DueReminder,
} from "@/lib/reminders";

type NewTransaction = Omit<InferInsertModel<typeof transactions>, "userId">;
type TransactionCategory = "presupuesto" | "recurring" | "other";

async function getSession() {
  return isE2E() ? getTestSession() : await auth();
}

async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}


export async function importTransactionsAction(data: NewTransaction[]) {
  try {
    const userId = await requireUserId();
    await db.insert(transactions).values(data.map(d => ({ ...d, userId })));
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error importing transactions:", message);
    return { success: false, error: "Error al insertar en la base de datos" };
  }
}

export async function createClientAction(
  data: Omit<InferInsertModel<typeof clients>, "userId">,
) {
  const userId = await requireUserId();
  const result = await db.insert(clients).values({ ...data, userId }).returning({ id: clients.id });
  revalidatePath("/");
  return { success: true, id: result[0].id };
}

export async function updateClientAction(
  id: number,
  data: Partial<InferInsertModel<typeof clients>>,
) {
  try {
    const userId = await requireUserId();
    await db.update(clients).set(data).where(and(eq(clients.id, id), eq(clients.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error updating client:", error);
    return { success: false, error: "No se pudo actualizar la entidad" };
  }
}

export async function deleteClientAction(id: number) {
  try {
    const userId = await requireUserId();
    // Check if client has ANY associated presupuestos or recurring services
    const associatedPresupuestos = await db.query.presupuestos.findFirst({
      where: and(eq(presupuestos.clientId, id), eq(presupuestos.userId, userId)),
    });

    const associatedServices = await db.query.recurringServices.findFirst({
      where: and(eq(recurringServices.clientId, id), eq(recurringServices.userId, userId)),
    });

    if (associatedPresupuestos || associatedServices) {
      return {
        success: false,
        error: "No se puede eliminar. La entidad tiene presupuestos o servicios vinculados."
      };
    }

    // Safe to delete physically
    await db.delete(clients).where(and(eq(clients.id, id), eq(clients.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error al eliminar cliente permanente:", error);
    return { success: false, error: "Error de integridad de base de datos al eliminar." };
  }
}

export async function createPresupuestoAction(data: {
  name: string;
  clientId: number;
  totalAmount: number;
  type: "ingreso" | "egreso";
  status?: string;
}) {
  try {
    const userId = await requireUserId();
    await db.insert(presupuestos).values({
      name: data.name,
      clientId: data.clientId,
      totalAmount: data.totalAmount,
      type: data.type,
      status: data.status || "activo",
      userId,
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false };
  }
}

async function checkAndFinalizePresupuesto(presupuestoId: number) {
  const presupuesto = await db.query.presupuestos.findFirst({
    where: eq(presupuestos.id, presupuestoId),
    with: { transactions: true },
  });
  if (!presupuesto || presupuesto.status === "finalizado") return;

  const totalPaid = presupuesto.transactions.reduce((s, t) => s + Math.abs(t.amount), 0);
  if (totalPaid >= Math.abs(presupuesto.totalAmount)) {
    await db.update(presupuestos).set({ status: "finalizado" }).where(eq(presupuestos.id, presupuestoId));
  }
}

async function recheckPresupuestoStatus(presupuestoId: number) {
  const presupuesto = await db.query.presupuestos.findFirst({
    where: eq(presupuestos.id, presupuestoId),
    with: { transactions: true },
  });
  if (!presupuesto) return;

  const totalPaid = presupuesto.transactions.reduce((s, t) => s + Math.abs(t.amount), 0);
  const newStatus = totalPaid >= Math.abs(presupuesto.totalAmount) ? "finalizado" : "activo";
  if (presupuesto.status !== newStatus) {
    await db.update(presupuestos).set({ status: newStatus }).where(eq(presupuestos.id, presupuestoId));
  }
}

export async function createTransactionAction(
  data: Omit<InferInsertModel<typeof transactions>, "userId">,
) {
  const userId = await requireUserId();
  let amount = data.amount;

  // Auto-negate amount for egreso presupuestos
  if (data.presupuestoId) {
    const linked = await db.query.presupuestos.findFirst({
      where: eq(presupuestos.id, data.presupuestoId),
    });
    if (linked?.type === "egreso" && amount > 0) {
      amount = -amount;
    }
  }

  await db.insert(transactions).values({ ...data, amount, userId });
  if (data.presupuestoId) {
    await checkAndFinalizePresupuesto(data.presupuestoId);
  }
  revalidatePath("/");
  return { success: true };
}

export async function createRecurringServiceAction(data: {
  name: string;
  clientId: number;
  amount: number;
  type?: "service" | "payment";
  billingDay?: number;
  startDate?: Date;
  endDate?: Date | null;
}) {
  try {
    const userId = await requireUserId();

    await db.insert(recurringServices).values({
      name: data.name,
      clientId: data.clientId,
      amount: data.amount,
      type: data.type || "service",
      billingDay: data.billingDay || 1,
      createdAt: new Date(),
      startDate: data.startDate ?? new Date(),
      endDate: data.endDate ?? null,
      userId,
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false };
  }
}

export async function createRecurringFromPresupuestoAction(data: {
  name: string;
  clientId: number;
  amount: number;
  billingDay?: number;
  startDate?: Date;
  endDate?: Date | null;
}) {
  try {
    const userId = await requireUserId();

    await db.insert(recurringServices).values({
      name: data.name,
      clientId: data.clientId,
      amount: data.amount,
      type: "payment",
      billingDay: data.billingDay || 1,
      createdAt: new Date(),
      startDate: data.startDate ?? new Date(),
      endDate: data.endDate ?? null,
      userId,
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false };
  }
}

type RawImportData = {
  clients: { name: string }[];
  presupuestos: {
    name: string;
    clientName: string;
    totalAmount: number;
    type: string;
    status?: string;
  }[];
  recurring: {
    name: string;
    clientName: string;
    amount: number;
    type: string;
  }[];
  transactions: {
    date: Date;
    imputedDate: Date;
    amount: number;
    category: string;
    description: string;
    targetName?: string;
  }[];
};

export async function bulkSmartImportAction(data: RawImportData) {
  try {
    const userId = await requireUserId();
    await db.transaction(async (tx) => {
      const clientMap = new Map<string, number>();

      const existingClients = await tx.query.clients.findMany({
        where: eq(clients.userId, userId),
      });
      existingClients.forEach((c) => clientMap.set(c.name.toLowerCase(), c.id));

      for (const c of data.clients) {
        const normalizedName = c.name.toLowerCase();
        if (!clientMap.has(normalizedName)) {
          const res = await tx
            .insert(clients)
            .values({ name: c.name, status: "active", userId })
            .returning({ id: clients.id });
          clientMap.set(normalizedName, res[0].id);
        }
      }

      const presupuestoMap = new Map<string, number>();
      const presupuestoTypeMap = new Map<number, string>();
      const serviceMap = new Map<string, number>();

      const existingPresupuestos = await tx.query.presupuestos.findMany({
        where: eq(presupuestos.userId, userId),
      });
      existingPresupuestos.forEach((p) => {
        presupuestoMap.set(p.name.toLowerCase(), p.id);
        presupuestoTypeMap.set(p.id, p.type);
      });

      const existingServices = await tx.query.recurringServices.findMany({
        where: eq(recurringServices.userId, userId),
      });
      existingServices.forEach((s) =>
        serviceMap.set(s.name.toLowerCase(), s.id),
      );

      for (const p of data.presupuestos || []) {
        const clientId = clientMap.get(p.clientName.toLowerCase());
        const normalizedName = p.name.toLowerCase();

        if (clientId && !presupuestoMap.has(normalizedName)) {
          const res = await tx
            .insert(presupuestos)
            .values({
              name: p.name,
              clientId,
              totalAmount: p.totalAmount,
              type: (p.type === "ingreso" || p.type === "egreso") ? p.type : "ingreso",
              status: p.status || "activo",
              userId,
            })
            .returning({ id: presupuestos.id });
          presupuestoMap.set(normalizedName, res[0].id);
          presupuestoTypeMap.set(res[0].id, (p.type === "ingreso" || p.type === "egreso") ? p.type : "ingreso");
        }
      }

      for (const r of data.recurring) {
        const clientId = clientMap.get(r.clientName.toLowerCase());
        const normalizedServiceName = r.name.toLowerCase();

        if (clientId && !serviceMap.has(normalizedServiceName)) {
          const res = await tx
            .insert(recurringServices)
            .values({
              name: r.name,
              clientId,
              amount: r.amount,
              type: r.type === "payment" ? "payment" : "service",
              createdAt: new Date(),
              startDate: new Date(),
              userId,
            })
            .returning({ id: recurringServices.id });
          serviceMap.set(normalizedServiceName, res[0].id);
        }
      }

      const transactionsToInsert = data.transactions.map(
        (t) => {
          let presupuestoId = null;
          let serviceId = null;

          if (t.targetName) {
            const target = t.targetName.toLowerCase();
            if (presupuestoMap.has(target))
              presupuestoId = presupuestoMap.get(target) ?? null;
            else if (serviceMap.has(target))
              serviceId = serviceMap.get(target) ?? null;
          }

          const category = (t.category === "project" || t.category === "pago")
            ? "presupuesto"
            : t.category;

          // Auto-negate for egreso presupuestos
          let amount = t.amount;
          if (presupuestoId && presupuestoTypeMap.get(presupuestoId) === "egreso" && amount > 0) {
            amount = -amount;
          }

          return {
            date: t.date,
            imputedDate: t.imputedDate,
            amount,
            category: category as TransactionCategory,
            description: t.description,
            presupuestoId: presupuestoId,
            serviceId: serviceId,
            status: "paid",
            userId,
          };
        },
      );

      if (transactionsToInsert.length > 0) {
        await tx.insert(transactions).values(transactionsToInsert);
      }
    });

    // Check all linked presupuestos for auto-finalization
    const allPresupuestos = await db.query.presupuestos.findMany({
      where: eq(presupuestos.userId, userId),
      with: { transactions: true },
    });
    for (const p of allPresupuestos) {
      if (p.status === "finalizado") continue;
      const totalPaid = p.transactions.reduce((s, t) => s + Math.abs(t.amount), 0);
      if (totalPaid >= Math.abs(p.totalAmount)) {
        await db.update(presupuestos).set({ status: "finalizado" }).where(eq(presupuestos.id, p.id));
      }
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error en importación inteligente:", error);
    return { success: false, error: "Fallo en la integridad de datos" };
  }
}

export async function updateTransactionAction(
  id: number,
  data: Partial<InferInsertModel<typeof transactions>>,
) {
  const userId = await requireUserId();
  await db.update(transactions).set(data).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  revalidatePath("/");
  return { success: true };
}

export async function updatePresupuestoAction(
  id: number,
  data: Partial<InferInsertModel<typeof presupuestos>>,
) {
  const userId = await requireUserId();
  await db.update(presupuestos).set(data).where(and(eq(presupuestos.id, id), eq(presupuestos.userId, userId)));
  revalidatePath("/");
  return { success: true };
}

export async function updateRecurringServiceAction(
  id: number,
  data: Partial<InferInsertModel<typeof recurringServices>>,
) {
  const userId = await requireUserId();
  await db
    .update(recurringServices)
    .set(data)
    .where(and(eq(recurringServices.id, id), eq(recurringServices.userId, userId)));
  revalidatePath("/");
  return { success: true };
}

export async function deleteTransactionAction(id: number) {
  try {
    const userId = await requireUserId();
    // Get the transaction before deleting to check presupuesto link
    const txn = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.userId, userId)),
    });
    await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    // Re-check presupuesto status after deletion
    if (txn?.presupuestoId) {
      await recheckPresupuestoStatus(txn.presupuestoId);
    }
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return { success: false, error: "No se pudo eliminar la transacción" };
  }
}

export async function deletePresupuestoAction(id: number) {
  try {
    const userId = await requireUserId();
    await db.transaction(async (tx) => {
      await tx
        .update(transactions)
        .set({ presupuestoId: null })
        .where(eq(transactions.presupuestoId, id));
      await tx.delete(presupuestos).where(and(eq(presupuestos.id, id), eq(presupuestos.userId, userId)));
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting presupuesto:", error);
    return { success: false, error: "No se pudo eliminar el presupuesto" };
  }
}

export async function deleteRecurringServiceAction(id: number) {
  try {
    const userId = await requireUserId();
    await db.transaction(async (tx) => {
      await tx
        .update(transactions)
        .set({ serviceId: null })
        .where(eq(transactions.serviceId, id));

      await tx.delete(recurringServices).where(and(eq(recurringServices.id, id), eq(recurringServices.userId, userId)));
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting recurring service:", error);
    return { success: false, error: "No se pudo eliminar el servicio" };
  }
}

function toNoonUTC(date: Date) {
  const d = new Date(date);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

export async function getRecurringCoverageAction(from: Date, to: Date) {
  const userId = await requireUserId();
  const dbFrom = new Date(from);
  dbFrom.setUTCHours(0, 0, 0, 0);
  const dbTo = new Date(to);
  dbTo.setUTCHours(23, 59, 59, 999);

  const allServices = await db.query.recurringServices.findMany({
    where: eq(recurringServices.userId, userId),
    with: { client: true },
  });

  // Lifecycle filter: only services whose [startDate, endDate] intersects
  // the queried [dbFrom, dbTo] window.
  const services = allServices.filter((s) => {
    const startsBeforeEnd = s.startDate.getTime() <= dbTo.getTime();
    const endsAfterStart =
      s.endDate == null || s.endDate.getTime() >= dbFrom.getTime();
    return startsBeforeEnd && endsAfterStart;
  });

  const relatedTransactions = await db.query.transactions.findMany({
    where: and(
      eq(transactions.category, "recurring"),
      between(transactions.date, dbFrom, dbTo),
      eq(transactions.userId, userId),
    ),
  });

  const results = services.map((service) => {
    const serviceTrans = relatedTransactions.filter(
      (t) => t.serviceId === service.id,
    );

    const paymentsByMonth: Record<string, number> = {};
    let totalCollected = 0;

    serviceTrans.forEach((t) => {
      const dateToUse = t.imputedDate || t.date;
      const key = dateToUse.toISOString().slice(0, 7);

      paymentsByMonth[key] = (paymentsByMonth[key] || 0) + t.amount;
      totalCollected += t.amount;
    });

    return {
      serviceId: service.id,
      serviceName: service.name,
      clientId: service.clientId,
      clientName: service.client?.name || "Sin Entidad",
      monthlyFee: service.amount,
      totalCollected,
      paymentsByMonth,
    };
  });

  return results;
}

export async function getOutstandingPerEntityAction(opts?: {
  kind?: "customer" | "collaborator" | "vendor";
}) {
  const userId = await requireUserId();
  const clientConds = [eq(clients.userId, userId)];
  if (opts?.kind) clientConds.push(eq(clients.kind, opts.kind));

  const rows = await db.query.clients.findMany({
    where: and(...clientConds),
    with: {
      presupuestos: {
        where: eq(presupuestos.type, "egreso"),
        with: { transactions: true },
      },
    },
  });

  return rows
    .filter((c) => c.presupuestos.length > 0)
    .map((c) => {
      const totalOwed = c.presupuestos.reduce(
        (s, p) => s + Math.abs(p.totalAmount),
        0,
      );
      const totalPaid = c.presupuestos.reduce(
        (s, p) =>
          s + p.transactions.reduce((ts, t) => ts + Math.abs(t.amount), 0),
        0,
      );
      return {
        clientId: c.id,
        clientName: c.name,
        kind: c.kind,
        totalOwed,
        totalPaid,
        outstanding: Math.max(0, totalOwed - totalPaid),
      };
    });
}

export async function setSlackWebhookAction(url: string | null) {
  const userId = await requireUserId();
  const value = url?.trim() ? url.trim() : null;
  await db.update(users).set({ slackWebhookUrl: value }).where(eq(users.id, userId));
  revalidatePath("/");
  return { success: true };
}

async function postToSlack(webhookUrl: string, payload: unknown) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook ${res.status}: ${await res.text()}`);
  }
}

async function findDueForUser(userId: string, today: Date): Promise<DueReminder[]> {
  const services = await db.query.recurringServices.findMany({
    where: eq(recurringServices.userId, userId),
    with: { client: true },
  });

  // We only need the current month's recurring transactions to know if a
  // billing cycle is already covered.
  const monthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );
  const monthEnd = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
  const txns = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      eq(transactions.category, "recurring"),
      between(transactions.date, monthStart, monthEnd),
    ),
    columns: { serviceId: true, category: true, date: true, imputedDate: true },
  });

  return findDueReminders(services, txns, today);
}

/**
 * User-scoped reminder send (UI button / MCP tool).
 * Returns {sent: false, reason} if no webhook or nothing due.
 */
export async function sendRecurringRemindersAction(opts?: { today?: Date }) {
  const userId = await requireUserId();
  const today = opts?.today ?? new Date();

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { slackWebhookUrl: true },
  });
  if (!user?.slackWebhookUrl) {
    return { sent: false, reason: "no_webhook_configured", due: [] as DueReminder[] };
  }
  const due = await findDueForUser(userId, today);
  if (due.length === 0) {
    return { sent: false, reason: "nothing_due", due };
  }
  await postToSlack(user.slackWebhookUrl, buildSlackMessage(due, today));
  return { sent: true, due };
}

/**
 * Cron entry point: iterates every user with a webhook configured.
 * Not exposed as a normal server action — called from /api/cron/reminders
 * after the CRON_SECRET check.
 */
export async function sendRemindersForAllUsers(today: Date = new Date()) {
  const all = await db.query.users.findMany({
    columns: { id: true, slackWebhookUrl: true },
  });
  const summary: { userId: string; sent: number; error?: string }[] = [];
  for (const u of all) {
    if (!u.slackWebhookUrl) continue;
    try {
      const due = await findDueForUser(u.id, today);
      if (due.length === 0) {
        summary.push({ userId: u.id, sent: 0 });
        continue;
      }
      await postToSlack(u.slackWebhookUrl, buildSlackMessage(due, today));
      summary.push({ userId: u.id, sent: due.length });
    } catch (err) {
      summary.push({
        userId: u.id,
        sent: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { ranAt: today.toISOString(), summary };
}

export async function setProfileTypeAction(
  profileType: "programador" | "marketing",
) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db
    .update(users)
    .set({ profileType })
    .where(eq(users.id, session.user.id));

  revalidatePath("/");
  return { success: true };
}
