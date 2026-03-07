import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { users, clients, presupuestos, recurringServices, transactions } from "../db/schema";
import { isNull } from "drizzle-orm";
import * as schema from "../db/schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const db = drizzle(client, { schema });

async function main() {
  // Find the first (and likely only) user
  const allUsers = await db.select().from(users);
  console.log("Users in DB:", allUsers.map((u) => ({ id: u.id, name: u.name, email: u.email })));

  if (allUsers.length === 0) {
    console.log("No users found. Log in first, then run this script again.");
    return;
  }

  const userId = allUsers[0].id;
  console.log(`\nAssigning all data to user: ${allUsers[0].name} (${userId})\n`);

  // Update clients with no userId
  const updatedClients = await db
    .update(clients)
    .set({ userId })
    .where(isNull(clients.userId))
    .returning({ id: clients.id, name: clients.name });
  console.log(`Updated ${updatedClients.length} clients`);

  // Update presupuestos with no userId
  const updatedPresupuestos = await db
    .update(presupuestos)
    .set({ userId })
    .where(isNull(presupuestos.userId))
    .returning({ id: presupuestos.id, name: presupuestos.name });
  console.log(`Updated ${updatedPresupuestos.length} presupuestos`);

  // Update recurring services with no userId
  const updatedServices = await db
    .update(recurringServices)
    .set({ userId })
    .where(isNull(recurringServices.userId))
    .returning({ id: recurringServices.id, name: recurringServices.name });
  console.log(`Updated ${updatedServices.length} recurring services`);

  // Update transactions with no userId
  const updatedTransactions = await db
    .update(transactions)
    .set({ userId })
    .where(isNull(transactions.userId))
    .returning({ id: transactions.id });
  console.log(`Updated ${updatedTransactions.length} transactions`);

  console.log("\nDone!");
}

main().catch(console.error);
