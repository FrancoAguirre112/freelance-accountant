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
  // Update transactions: merge 'maintenance' and 'salary' into 'recurring'
  const txResult = await db.run(
    sql`UPDATE transactions SET category = 'recurring' WHERE category IN ('maintenance', 'salary')`
  );
  console.log(`Updated transactions: ${txResult.rowsAffected} rows`);

  // Drop the 'type' column from recurring_services
  // SQLite doesn't support DROP COLUMN directly in older versions,
  // but Turso/libsql supports it
  try {
    await db.run(sql`ALTER TABLE recurring_services DROP COLUMN type`);
    console.log("Dropped 'type' column from recurring_services");
  } catch (e) {
    console.log("Note: Could not drop 'type' column (may already be removed):", (e as Error).message);
  }

  console.log("\nDone!");
}

main().catch(console.error);
