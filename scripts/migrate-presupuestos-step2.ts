import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL?.replace("libsql://", "https://");
const client = createClient({
  url: url!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function migrate() {
  console.log("Continuing migration (steps 8-9)...");

  // 8. Recreate transactions table without old FK columns
  await client.execute(`
    CREATE TABLE transactions_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES "user"(id) ON DELETE CASCADE,
      date INTEGER NOT NULL,
      imputed_date INTEGER,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      presupuesto_id INTEGER REFERENCES presupuestos(id),
      service_id INTEGER REFERENCES recurring_services(id),
      status TEXT DEFAULT 'paid'
    )
  `);

  await client.execute(`
    INSERT INTO transactions_new (id, user_id, date, imputed_date, amount, category, description, presupuesto_id, service_id, status)
    SELECT id, user_id, date, imputed_date, amount, category, description, presupuesto_id, service_id, status
    FROM transactions
  `);

  await client.execute("DROP TABLE transactions");
  await client.execute("ALTER TABLE transactions_new RENAME TO transactions");

  // Recreate indexes
  await client.execute("CREATE INDEX transactions_user_id_idx ON transactions(user_id)");
  await client.execute("CREATE INDEX transactions_user_date_idx ON transactions(user_id, date)");

  console.log("Recreated transactions table without old FK columns");

  // 9. Drop old tables
  await client.execute("DROP TABLE IF EXISTS projects");
  await client.execute("DROP TABLE IF EXISTS pagos");

  console.log("Dropped old projects and pagos tables");
  console.log("Migration complete!");
}

migrate().catch(console.error);
