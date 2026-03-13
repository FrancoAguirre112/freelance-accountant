import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import { eq, isNull } from "drizzle-orm";

const url = process.env.TURSO_DATABASE_URL?.replace("libsql://", "https://");
const client = createClient({ url: url!, authToken: process.env.TURSO_AUTH_TOKEN! });
const db = drizzle(client, { schema });

async function main() {
  const services = await db.query.recurringServices.findMany({
    where: isNull(schema.recurringServices.createdAt),
  });

  console.log(`Found ${services.length} services without createdAt`);

  for (const service of services) {
    const earliest = await db.query.transactions.findFirst({
      where: eq(schema.transactions.serviceId, service.id),
      orderBy: (t, { asc }) => [asc(t.date)],
    });

    const createdAt = earliest?.date || new Date();

    await db
      .update(schema.recurringServices)
      .set({ createdAt })
      .where(eq(schema.recurringServices.id, service.id));

    console.log(`${service.name}: set createdAt to ${createdAt.toISOString()}`);
  }

  console.log("Done!");
}

main().catch(console.error);
