"use server";

import { db } from "@/db";
import {
  clients,
  projects,
  transactions,
  recurringServices,
  users,
} from "@/db/schema";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { type InferInsertModel, eq, and, between } from "drizzle-orm";

type NewTransaction = Omit<InferInsertModel<typeof transactions>, "userId">;
type TransactionCategory = "project" | "recurring" | "other";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

async function findOrCreateClient(name: string, userId: string): Promise<number> {
  const existingClient = await db.query.clients.findFirst({
    where: and(eq(clients.name, name), eq(clients.userId, userId)),
  });

  if (existingClient) {
    return existingClient.id;
  }

  const newClient = await db
    .insert(clients)
    .values({ name, status: "active", userId })
    .returning({ id: clients.id });

  return newClient[0].id;
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
  await db.insert(clients).values({ ...data, userId });
  revalidatePath("/");
  return { success: true };
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
    return { success: false, error: "No se pudo actualizar el cliente" };
  }
}

export async function deleteClientAction(id: number) {
  try {
    const userId = await requireUserId();
    // Check if client has ANY associated projects or recurring services
    const associatedProjects = await db.query.projects.findFirst({
      where: and(eq(projects.clientId, id), eq(projects.userId, userId)),
    });

    const associatedServices = await db.query.recurringServices.findFirst({
      where: and(eq(recurringServices.clientId, id), eq(recurringServices.userId, userId)),
    });

    if (associatedProjects || associatedServices) {
      return {
        success: false,
        error: "No se puede eliminar. El cliente tiene proyectos o servicios vinculados."
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

export async function createProjectAction(data: {
  name: string;
  clientId: number;
  totalAmount: number;
  status: string;
}) {
  try {
    const userId = await requireUserId();
    await db.insert(projects).values({
      name: data.name,
      clientId: data.clientId,
      totalAmount: data.totalAmount,
      status: data.status,
      userId,
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false };
  }
}

export async function createTransactionAction(
  data: Omit<InferInsertModel<typeof transactions>, "userId">,
) {
  const userId = await requireUserId();
  await db.insert(transactions).values({ ...data, userId });
  revalidatePath("/");
  return { success: true };
}

export async function createRecurringServiceAction(data: {
  name: string;
  clientName: string;
  amount: number;
}) {
  try {
    const userId = await requireUserId();
    const clientId = await findOrCreateClient(data.clientName, userId);

    await db.insert(recurringServices).values({
      name: data.name,
      clientId: clientId,
      amount: data.amount,
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

      const projectMap = new Map<string, number>();
      const serviceMap = new Map<string, number>();

      const existingProjects = await tx.query.projects.findMany({
        where: eq(projects.userId, userId),
      });
      existingProjects.forEach((p) =>
        projectMap.set(p.name.toLowerCase(), p.id),
      );

      const existingServices = await tx.query.recurringServices.findMany({
        where: eq(recurringServices.userId, userId),
      });
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
              userId,
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
              userId,
            })
            .returning({ id: recurringServices.id });
          serviceMap.set(normalizedServiceName, res[0].id);
        }
      }

      const transactionsToInsert = data.transactions.map(
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
            userId,
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
  const userId = await requireUserId();
  await db.update(transactions).set(data).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  revalidatePath("/");
  return { success: true };
}

export async function updateProjectAction(
  id: number,
  data: Partial<InferInsertModel<typeof projects>>,
) {
  const userId = await requireUserId();
  await db.update(projects).set(data).where(and(eq(projects.id, id), eq(projects.userId, userId)));
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
    await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return { success: false, error: "No se pudo eliminar la transacción" };
  }
}

export async function deleteProjectAction(id: number) {
  try {
    const userId = await requireUserId();
    await db.transaction(async (tx) => {
      await tx
        .update(transactions)
        .set({ projectId: null })
        .where(eq(transactions.projectId, id));

      await tx.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, userId)));
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

  const services = await db.query.recurringServices.findMany({
    where: eq(recurringServices.userId, userId),
    with: { client: true },
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
      clientName: service.client?.name || "Sin Cliente",
      monthlyFee: service.amount,
      totalCollected,
      paymentsByMonth,
    };
  });

  return results;
}

export async function setProfileTypeAction(
  profileType: "programador" | "marketing",
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db
    .update(users)
    .set({ profileType })
    .where(eq(users.id, session.user.id));

  revalidatePath("/");
  return { success: true };
}
