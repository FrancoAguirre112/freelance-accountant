import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL?.replace("libsql://", "https://");
const client = createClient({
  url: url!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function migrate() {
  console.log("Starting migration...");

  // 1. Create presupuestos table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS presupuestos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
      client_id INTEGER REFERENCES clients(id),
      name TEXT NOT NULL,
      total_amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('ingreso', 'egreso')),
      status TEXT DEFAULT 'activo'
    )
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS presupuestos_user_id_idx ON presupuestos(user_id)
  `);

  console.log("Created presupuestos table");

  // 2. Copy projects → presupuestos (ingreso)
  await client.execute(`
    INSERT INTO presupuestos (id, user_id, client_id, name, total_amount, type, status)
    SELECT id, user_id, client_id, name, total_amount, 'ingreso',
      CASE status
        WHEN 'en_desarrollo' THEN 'activo'
        WHEN 'finalizado' THEN 'finalizado'
        WHEN 'pausado' THEN 'pausado'
        ELSE 'activo'
      END
    FROM projects
  `);

  const projectCount = await client.execute("SELECT COUNT(*) as c FROM projects");
  console.log(`Migrated ${projectCount.rows[0].c} projects as ingresos`);

  // 3. Copy pagos → presupuestos (egreso) with offset IDs
  const maxId = await client.execute("SELECT COALESCE(MAX(id), 0) as m FROM presupuestos");
  const offset = Number(maxId.rows[0].m);

  await client.execute(`
    INSERT INTO presupuestos (id, user_id, client_id, name, total_amount, type, status)
    SELECT id + ${offset}, user_id, client_id, name, total_amount, 'egreso',
      CASE status
        WHEN 'pendiente' THEN 'activo'
        WHEN 'pago_parcial' THEN 'activo'
        WHEN 'saldado' THEN 'finalizado'
        ELSE 'activo'
      END
    FROM pagos
  `);

  const pagoCount = await client.execute("SELECT COUNT(*) as c FROM pagos");
  console.log(`Migrated ${pagoCount.rows[0].c} pagos as egresos (offset: ${offset})`);

  // 4. Add presupuesto_id column to transactions
  await client.execute(`
    ALTER TABLE transactions ADD COLUMN presupuesto_id INTEGER REFERENCES presupuestos(id)
  `);

  console.log("Added presupuesto_id column to transactions");

  // 5. Map project_id → presupuesto_id (same id, no offset)
  await client.execute(`
    UPDATE transactions SET presupuesto_id = project_id WHERE project_id IS NOT NULL
  `);

  // 6. Map pago_id → presupuesto_id (with offset)
  await client.execute(`
    UPDATE transactions SET presupuesto_id = pago_id + ${offset} WHERE pago_id IS NOT NULL
  `);

  console.log("Mapped transaction foreign keys");

  // 7. Update categories
  await client.execute(`
    UPDATE transactions SET category = 'presupuesto' WHERE category IN ('project', 'pago')
  `);

  console.log("Updated transaction categories");

  // 8. Recreate transactions table without old FK columns (SQLite can't drop columns with FK constraints)
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
