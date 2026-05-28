import { clients, presupuestos, recurringServices, transactions, users } from "@/db/schema";
import type { TestDb } from "./db";

export const TEST_USER_ID = "user_test_1";
export const OTHER_USER_ID = "user_test_2";

export async function seedUser(db: TestDb, id = TEST_USER_ID, profileType: "programador" | "marketing" | null = "programador") {
  await db.insert(users).values({ id, email: `${id}@example.com`, name: id, profileType });
  return id;
}

export async function seedClient(
  db: TestDb,
  overrides: Partial<{
    name: string;
    status: string;
    userId: string;
    kind: "customer" | "collaborator" | "vendor";
  }> = {},
) {
  const [row] = await db
    .insert(clients)
    .values({
      name: overrides.name ?? "Acme",
      status: overrides.status ?? "active",
      kind: overrides.kind ?? "customer",
      userId: overrides.userId ?? TEST_USER_ID,
    })
    .returning();
  return row;
}

export async function seedPresupuesto(
  db: TestDb,
  overrides: Partial<{
    name: string;
    clientId: number;
    totalAmount: number;
    type: "ingreso" | "egreso";
    status: string;
    userId: string;
  }> = {},
) {
  const [row] = await db
    .insert(presupuestos)
    .values({
      name: overrides.name ?? "Budget",
      clientId: overrides.clientId ?? null,
      totalAmount: overrides.totalAmount ?? 1000,
      type: overrides.type ?? "ingreso",
      status: overrides.status ?? "activo",
      userId: overrides.userId ?? TEST_USER_ID,
    })
    .returning();
  return row;
}

export async function seedRecurring(
  db: TestDb,
  overrides: Partial<{
    name: string;
    clientId: number;
    amount: number;
    type: "service" | "payment";
    billingDay: number;
    userId: string;
    startDate: Date;
    endDate: Date | null;
  }> = {},
) {
  const [row] = await db
    .insert(recurringServices)
    .values({
      name: overrides.name ?? "Hosting",
      clientId: overrides.clientId ?? null,
      amount: overrides.amount ?? 50,
      type: overrides.type ?? "service",
      billingDay: overrides.billingDay ?? 1,
      createdAt: new Date("2026-01-01T12:00:00Z"),
      startDate: overrides.startDate ?? new Date("2026-01-01T12:00:00Z"),
      endDate: overrides.endDate ?? null,
      userId: overrides.userId ?? TEST_USER_ID,
    })
    .returning();
  return row;
}

export async function seedTransaction(
  db: TestDb,
  overrides: Partial<{
    date: Date;
    imputedDate: Date | null;
    amount: number;
    category: "presupuesto" | "recurring" | "other";
    description: string;
    presupuestoId: number | null;
    serviceId: number | null;
    userId: string;
  }> = {},
) {
  const [row] = await db
    .insert(transactions)
    .values({
      date: overrides.date ?? new Date("2026-03-01T12:00:00Z"),
      imputedDate: overrides.imputedDate ?? null,
      amount: overrides.amount ?? 100,
      category: overrides.category ?? "other",
      description: overrides.description ?? "Test txn",
      presupuestoId: overrides.presupuestoId ?? null,
      serviceId: overrides.serviceId ?? null,
      userId: overrides.userId ?? TEST_USER_ID,
    })
    .returning();
  return row;
}
