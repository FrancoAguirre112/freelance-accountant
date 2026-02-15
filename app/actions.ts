"use server";

import { db } from "@/db";
import {
  clients,
  projects,
  transactions,
  recurringServices,
} from "@/db/schema";
import { revalidatePath } from "next/cache";
import { type InferInsertModel, eq, and, between, desc } from "drizzle-orm";
import {
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  isSameMonth,
} from "date-fns";

// 1. Define strict types derived from the schema or for specific enums
type NewTransaction = InferInsertModel<typeof transactions>;
type TransactionCategory = "project" | "salary" | "maintenance" | "other";
type RecurringType = "maintenance" | "salary";

// Helper function to find or create a client
async function findOrCreateClient(name: string): Promise<number> {
  const existingClient = await db.query.clients.findFirst({
    where: eq(clients.name, name),
  });

  if (existingClient) {
    return existingClient.id;
  }

  const newClient = await db
    .insert(clients)
    .values({ name, status: "active" })
    .returning({ id: clients.id });

  return newClient[0].id;
}

export async function importTransactionsAction(data: NewTransaction[]) {
  try {
    await db.insert(transactions).values(data);
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
  data: InferInsertModel<typeof clients>,
) {
  await db.insert(clients).values(data);
  revalidatePath("/");
  return { success: true };
}

export async function createProjectAction(data: {
  name: string;
  clientName: string;
  totalAmount: number;
  status: string;
}) {
  try {
    const clientId = await findOrCreateClient(data.clientName);

    await db.insert(projects).values({
      name: data.name,
      clientId: clientId,
      totalAmount: data.totalAmount,
      status: data.status,
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false };
  }
}

export async function createTransactionAction(
  data: InferInsertModel<typeof transactions>,
) {
  await db.insert(transactions).values(data);
  revalidatePath("/");
  return { success: true };
}

export async function createRecurringServiceAction(data: {
  name: string;
  clientName: string;
  amount: number;
  type: "maintenance" | "salary";
}) {
  try {
    const clientId = await findOrCreateClient(data.clientName);

    await db.insert(recurringServices).values({
      name: data.name,
      clientId: clientId,
      amount: data.amount,
      type: data.type,
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
  projects: {
    name: string;
    clientName: string;
    totalAmount: number;
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
    await db.transaction(async (tx) => {
      // --- PHASE 1: RESOLVE CLIENTS ---
      const clientMap = new Map<string, number>();

      const existingClients = await tx.query.clients.findMany();
      existingClients.forEach((c) => clientMap.set(c.name.toLowerCase(), c.id));

      for (const c of data.clients) {
        const normalizedName = c.name.toLowerCase();
        if (!clientMap.has(normalizedName)) {
          const res = await tx
            .insert(clients)
            .values({ name: c.name, status: "active" })
            .returning({ id: clients.id });
          clientMap.set(normalizedName, res[0].id);
        }
      }

      // --- PHASE 2: RESOLVE PROJECTS AND SERVICES ---
      const projectMap = new Map<string, number>();
      const serviceMap = new Map<string, number>();

      const existingProjects = await tx.query.projects.findMany();
      existingProjects.forEach((p) =>
        projectMap.set(p.name.toLowerCase(), p.id),
      );

      const existingServices = await tx.query.recurringServices.findMany();
      existingServices.forEach((s) =>
        serviceMap.set(s.name.toLowerCase(), s.id),
      );

      // Insert Projects
      for (const p of data.projects) {
        const clientId = clientMap.get(p.clientName.toLowerCase());
        const normalizedProjName = p.name.toLowerCase();

        if (clientId && !projectMap.has(normalizedProjName)) {
          const res = await tx
            .insert(projects)
            .values({
              name: p.name,
              clientId,
              totalAmount: p.totalAmount,
              status: p.status || "en_desarrollo",
            })
            .returning({ id: projects.id });
          projectMap.set(normalizedProjName, res[0].id);
        }
      }

      // Insert Recurring Services
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
              type: r.type as RecurringType,
            })
            .returning({ id: recurringServices.id });
          serviceMap.set(normalizedServiceName, res[0].id);
        }
      }

      // --- PHASE 3: TRANSACTIONS ---
      const transactionsToInsert: NewTransaction[] = data.transactions.map(
        (t) => {
          let projectId = null;
          let serviceId = null;

          if (t.targetName) {
            const target = t.targetName.toLowerCase();
            if (projectMap.has(target))
              projectId = projectMap.get(target) ?? null;
            else if (serviceMap.has(target))
              serviceId = serviceMap.get(target) ?? null;
          }

          return {
            date: t.date,
            imputedDate: t.imputedDate,
            amount: t.amount,
            category: t.category as TransactionCategory,
            description: t.description,
            projectId: projectId,
            serviceId: serviceId,
            status: "paid",
          };
        },
      );

      if (transactionsToInsert.length > 0) {
        await tx.insert(transactions).values(transactionsToInsert);
      }
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error en importación inteligente:", error);
    return { success: false, error: "Fallo en la integridad de datos" };
  }
}

// --- UPDATE ACTIONS ---

export async function updateTransactionAction(
  id: number,
  data: Partial<InferInsertModel<typeof transactions>>,
) {
  await db.update(transactions).set(data).where(eq(transactions.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function updateProjectAction(
  id: number,
  data: Partial<InferInsertModel<typeof projects>>,
) {
  await db.update(projects).set(data).where(eq(projects.id, id));
  revalidatePath("/");
  return { success: true };
}

export async function updateRecurringServiceAction(
  id: number,
  data: Partial<InferInsertModel<typeof recurringServices>>,
) {
  await db
    .update(recurringServices)
    .set(data)
    .where(eq(recurringServices.id, id));
  revalidatePath("/");
  return { success: true };
}

// --- DELETE ACTIONS (CORREGIDAS) ---

export async function deleteTransactionAction(id: number) {
  // Las transacciones no tienen dependencias hacia abajo, se pueden borrar directo
  try {
    await db.delete(transactions).where(eq(transactions.id, id));
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return { success: false, error: "No se pudo eliminar la transacción" };
  }
}

export async function deleteProjectAction(id: number) {
  try {
    await db.transaction(async (tx) => {
      // 1. Primero desvinculamos las transacciones asociadas (para no perder el registro financiero)
      await tx
        .update(transactions)
        .set({ projectId: null })
        .where(eq(transactions.projectId, id));

      // 2. Ahora es seguro eliminar el proyecto
      await tx.delete(projects).where(eq(projects.id, id));
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting project:", error);
    return { success: false, error: "No se pudo eliminar el proyecto" };
  }
}

export async function deleteRecurringServiceAction(id: number) {
  try {
    await db.transaction(async (tx) => {
      // 1. Desvinculamos las transacciones asociadas
      await tx
        .update(transactions)
        .set({ serviceId: null })
        .where(eq(transactions.serviceId, id));

      // 2. Eliminamos el servicio
      await tx.delete(recurringServices).where(eq(recurringServices.id, id));
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting recurring service:", error);
    return { success: false, error: "No se pudo eliminar el servicio" };
  }
}

export async function getSalaryCoverageAction(from: Date, to: Date) {
  // 1. Obtenemos el "Objetivo Mensual" sumando todos los servicios recurrentes de tipo "salary"
  const salaryServices = await db.query.recurringServices.findMany({
    where: eq(recurringServices.type, "salary"),
  });

  const totalMonthlyTarget = salaryServices.reduce(
    (sum, s) => sum + s.amount,
    0,
  );

  // 2. Buscamos todas las transacciones de categoría "salary" en el rango de fechas
  const salaryTransactions = await db.query.transactions.findMany({
    where: and(
      eq(transactions.category, "salary"),
      between(transactions.date, from, to),
    ),
  });

  // 3. Agrupamos los ingresos por mes
  const coverageMap = new Map<string, number>();

  salaryTransactions.forEach((t) => {
    // Usamos el inicio del mes como clave para agrupar
    const monthKey = startOfMonth(t.date).toISOString();
    const currentAmount = coverageMap.get(monthKey) || 0;
    coverageMap.set(monthKey, currentAmount + t.amount);
  });

  // 4. Formateamos la respuesta
  // Convertimos el mapa a un array.
  // Nota: Si un mes no tiene transacciones, no aparecerá aquí,
  // pero el componente SalaryTab rellena los huecos usando 'eachMonthOfInterval'.
  const results = Array.from(coverageMap.entries()).map(
    ([monthIso, amount]) => ({
      month: monthIso, // Devolvemos string ISO para serialización segura
      amount: amount,
      target: totalMonthlyTarget,
    }),
  );

  return results;
}

export async function getMaintenanceCoverageAction(from: Date, to: Date) {
  // 1. Fetch all active maintenance services
  const services = await db.query.recurringServices.findMany({
    where: eq(recurringServices.type, "maintenance"),
    with: {
      client: true,
    },
  });

  // 2. Fetch transactions linked to these services in the date range
  const relatedTransactions = await db.query.transactions.findMany({
    where: and(
      // We filter by category OR if it has a serviceId linked (more robust)
      // For simplicity, we assume maintenance transactions have category 'maintenance'
      eq(transactions.category, "maintenance"),
      between(transactions.date, from, to),
    ),
  });

  // 3. Generate the timeline (months)
  const months = eachMonthOfInterval({
    start: startOfMonth(from),
    end: endOfMonth(to),
  });

  // 4. Build the structured data
  const results = services.map((service) => {
    // Filter transactions for this specific service
    // We match by serviceId (ideal) or fallback to matching Description/Client if you used the old import method
    // Since we fixed the import, we rely on serviceId primarily.
    const serviceTrans = relatedTransactions.filter(
      (t) => t.serviceId === service.id,
    );

    let monthsCoveredCount = 0;
    let totalCollected = 0;

    const monthDetails = months.map((monthDate) => {
      // Find payments that fall into this month
      // Logic: A transaction 'pays' for the month it is imputed to (imputedDate)
      // or the real date if imputed is missing.
      const paymentsInMonth = serviceTrans.filter((t) =>
        isSameMonth(t.imputedDate || t.date, monthDate),
      );

      const paidAmount = paymentsInMonth.reduce((sum, t) => sum + t.amount, 0);
      const isCovered = paidAmount >= service.amount; // Allow partial coverage logic if needed

      if (isCovered) monthsCoveredCount++;
      totalCollected += paidAmount;

      return {
        date: monthDate,
        target: service.amount,
        paid: paidAmount,
        status: isCovered ? "paid" : paidAmount > 0 ? "partial" : "pending",
      };
    });

    return {
      serviceId: service.id,
      serviceName: service.name,
      clientName: service.client?.name || "Sin Cliente",
      monthlyFee: service.amount,
      totalCollected,
      totalTarget: service.amount * months.length,
      monthsCovered: monthsCoveredCount,
      totalMonths: months.length,
      details: monthDetails, // The detailed breakdown
    };
  });

  return results;
}
