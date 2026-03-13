import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import { eq, and } from "drizzle-orm";

const url = process.env.TURSO_DATABASE_URL?.replace("libsql://", "https://");
const client = createClient({ url: url!, authToken: process.env.TURSO_AUTH_TOKEN! });
const db = drizzle(client, { schema });

async function main() {
  // Find user franco.aguirre@rtndigitalhub.com
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, "franco.aguirre@rtndigitalhub.com"),
  });

  if (!user) {
    console.log("User not found!");
    return;
  }

  console.log(`Found user: ${user.email} (${user.id})`);

  // Get all recurring services for this user
  const services = await db.query.recurringServices.findMany({
    where: eq(schema.recurringServices.userId, user.id),
  });

  console.log(`Found ${services.length} recurring services`);

  // Set billingDay to 1 for all services (so next due = April 1st for March)
  for (const service of services) {
    await db
      .update(schema.recurringServices)
      .set({ billingDay: 1 })
      .where(eq(schema.recurringServices.id, service.id));

    console.log(`${service.name}: billingDay set to 1`);
  }

  console.log("Done! All services now have billingDay=1 (next due: April 1st)");
}

main().catch(console.error);
