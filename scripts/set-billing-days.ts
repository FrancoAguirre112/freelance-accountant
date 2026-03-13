import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const db = drizzle(client);

async function main() {
  // Get all recurring services
  const services = await db.all<{ id: number; name: string }>(
    sql`SELECT id, name FROM recurring_services`
  );

  for (const service of services) {
    // Find the most recent transaction for this service
    const lastTx = await db.all<{ date: number }>(
      sql`SELECT date FROM transactions WHERE service_id = ${service.id} AND category = 'recurring' ORDER BY date DESC LIMIT 1`
    );

    let billingDay = 1; // default
    if (lastTx.length > 0) {
      const lastDate = new Date(lastTx[0].date * 1000);
      billingDay = lastDate.getUTCDate();
    }

    await db.run(
      sql`UPDATE recurring_services SET billing_day = ${billingDay} WHERE id = ${service.id}`
    );
    console.log(`${service.name}: billing_day = ${billingDay}${lastTx.length > 0 ? " (from last payment)" : " (default)"}`);
  }

  console.log("\nDone!");
}

main().catch(console.error);
