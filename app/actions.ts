"use server";

import { db } from "@/db";
import {
  clients,
  projects,
  transactions,
  recurringServices,
} from "@/db/schema";
import { revalidatePath } from "next/cache";
import { type InferInsertModel } from "drizzle-orm";

// Definimos el tipo exacto que espera la tabla de transacciones
type NewTransaction = InferInsertModel<typeof transactions>;

export async function importTransactionsAction(data: NewTransaction[]) {
  try {
    // Drizzle valida que 'data' cumpla con la estructura de la tabla
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

export async function createProjectAction(
  data: InferInsertModel<typeof projects>,
) {
  await db.insert(projects).values(data);
  revalidatePath("/");
  return { success: true };
}

export async function createTransactionAction(
  data: InferInsertModel<typeof transactions>,
) {
  await db.insert(transactions).values(data);
  revalidatePath("/");
  return { success: true };
}

export async function createRecurringServiceAction(
  data: InferInsertModel<typeof recurringServices>,
) {
  try {
    await db.insert(recurringServices).values(data);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error creating recurring service:", error);
    return { success: false };
  }
}

export async function bulkSmartImportAction(data: {
  clients?: InferInsertModel<typeof clients>[];
  projects?: InferInsertModel<typeof projects>[];
  transactions?: InferInsertModel<typeof transactions>[];
  recurring?: InferInsertModel<typeof recurringServices>[];
}) {
  try {
    // Ejecutamos las inserciones en orden de dependencia
    if (data.clients?.length) await db.insert(clients).values(data.clients);
    if (data.projects?.length) await db.insert(projects).values(data.projects);
    if (data.recurring?.length)
      await db.insert(recurringServices).values(data.recurring);
    if (data.transactions?.length)
      await db.insert(transactions).values(data.transactions);

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error en importación masiva:", error);
    return { success: false };
  }
}
