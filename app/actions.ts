"use server";

import { db } from "@/db";
import {
  clients,
  projects,
  transactions,
  recurringServices,
} from "@/db/schema";
import { revalidatePath } from "next/cache";
import { type InferInsertModel, eq, and, between } from "drizzle-orm";
import {
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  isSameMonth,
  startOfDay,
  endOfDay,
} from "date-fns";

type NewTransaction = InferInsertModel<typeof transactions>;
type TransactionCategory = "project" | "salary" | "maintenance" | "other";
type RecurringType = "maintenance" | "salary";

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

export async function updateClientAction(
  id: number,
  data: Partial<InferInsertModel<typeof clients>>,
) {
  try {
    await db.update(clients).set(data).where(eq(clients.id, id));
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error updating client:", error);
    return { success: false, error: "No se pudo actualizar el cliente" };
  }
}

export async function deleteClientAction(id: number) {
  try {
    // Check if client has ANY associated projects or recurring services
    const associatedProjects = await db.query.projects.findFirst({
      where: eq(projects.clientId, id),
    });

    const associatedServices = await db.query.recurringServices.findFirst({
      where: eq(recurringServices.clientId, id),
    });

    if (associatedProjects || associatedServices) {
      return { 
        success: false, 
        error: "No se puede eliminar. El cliente tiene proyectos o servicios vinculados." 
      };
    }

    // Safe to delete physically
    await db.delete(clients).where(eq(clients.id, id));
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error al eliminar cliente permanente:", error);
    return { success: false, error: "Error de integridad de base de datos al eliminar." };
  }
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

export async function deleteTransactionAction(id: number) {
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
      await tx
        .update(transactions)
        .set({ projectId: null })
        .where(eq(transactions.projectId, id));

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
      await tx
        .update(transactions)
        .set({ serviceId: null })
        .where(eq(transactions.serviceId, id));

      await tx.delete(recurringServices).where(eq(recurringServices.id, id));
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

export async function getSalaryCoverageAction(from: Date, to: Date) {
  // Ensure we query the full days
  const dbFrom = new Date(from);
  dbFrom.setUTCHours(0, 0, 0, 0);
  const dbTo = new Date(to);
  dbTo.setUTCHours(23, 59, 59, 999);

  const salaryServices = await db.query.recurringServices.findMany({
    where: eq(recurringServices.type, "salary"),
  });

  const totalMonthlyTarget = salaryServices.reduce(
    (sum, s) => sum + s.amount,
    0,
  );

  const salaryTransactions = await db.query.transactions.findMany({
    where: and(
      eq(transactions.category, "salary"),
      between(transactions.date, dbFrom, dbTo),
    ),
  });

  // Group by STRING KEY "YYYY-MM"
  // This is timezone-proof because ISO string is standard
  const coverageMap = new Map<string, number>();

  salaryTransactions.forEach((t) => {
    // Extract "2026-01" from "2026-01-05T..."
    const monthKey = t.date.toISOString().slice(0, 7);
    const currentAmount = coverageMap.get(monthKey) || 0;
    coverageMap.set(monthKey, currentAmount + t.amount);
  });

  // Return simple object: { "2026-01": 500, "2026-02": 0 }
  return {
    monthlyTarget: totalMonthlyTarget,
    // Convert Map to plain object
    data: Object.fromEntries(coverageMap),
  };
}

export async function getMaintenanceCoverageAction(from: Date, to: Date) {
  const dbFrom = new Date(from);
  dbFrom.setUTCHours(0, 0, 0, 0);
  const dbTo = new Date(to);
  dbTo.setUTCHours(23, 59, 59, 999);

  const services = await db.query.recurringServices.findMany({
    where: eq(recurringServices.type, "maintenance"),
    with: { client: true },
  });

  const relatedTransactions = await db.query.transactions.findMany({
    where: and(
      eq(transactions.category, "maintenance"),
      between(transactions.date, dbFrom, dbTo),
    ),
  });

  const results = services.map((service) => {
    // Get transactions for this service
    const serviceTrans = relatedTransactions.filter(
      (t) => t.serviceId === service.id,
    );

    // Group payments by month key "YYYY-MM"
    const paymentsByMonth: Record<string, number> = {};
    let totalCollected = 0;

    serviceTrans.forEach((t) => {
      // Use imputedDate if available, otherwise real date
      const dateToUse = t.imputedDate || t.date;
      const key = dateToUse.toISOString().slice(0, 7); // "2026-01"

      paymentsByMonth[key] = (paymentsByMonth[key] || 0) + t.amount;
      totalCollected += t.amount;
    });

    return {
      serviceId: service.id,
      serviceName: service.name,
      clientId: service.clientId,
      clientName: service.client?.name || "Sin Cliente",
      monthlyFee: service.amount,
      totalCollected,
      paymentsByMonth,
    };
  });

  return results;
}
