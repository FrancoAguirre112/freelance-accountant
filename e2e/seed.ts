import { createClient } from "@libsql/client";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const DDL = [
  `CREATE TABLE IF NOT EXISTS "user" (id TEXT PRIMARY KEY NOT NULL, name TEXT, email TEXT UNIQUE, emailVerified INTEGER, image TEXT, profileType TEXT, slackWebhookUrl TEXT);`,
  `CREATE TABLE IF NOT EXISTS "account" (userId TEXT NOT NULL, type TEXT NOT NULL, provider TEXT NOT NULL, providerAccountId TEXT NOT NULL, refresh_token TEXT, access_token TEXT, expires_at INTEGER, token_type TEXT, scope TEXT, id_token TEXT, session_state TEXT);`,
  `CREATE TABLE IF NOT EXISTS "session" (sessionToken TEXT PRIMARY KEY NOT NULL, userId TEXT NOT NULL, expires INTEGER NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS "verificationToken" (identifier TEXT NOT NULL, token TEXT NOT NULL, expires INTEGER NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS "clients" (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, user_id TEXT, name TEXT NOT NULL, status TEXT DEFAULT 'active', kind TEXT DEFAULT 'customer');`,
  `CREATE TABLE IF NOT EXISTS "presupuestos" (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, user_id TEXT, client_id INTEGER, name TEXT NOT NULL, total_amount REAL NOT NULL, type TEXT NOT NULL, status TEXT DEFAULT 'activo');`,
  `CREATE TABLE IF NOT EXISTS "recurring_services" (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, user_id TEXT, client_id INTEGER, name TEXT NOT NULL, amount REAL NOT NULL, type TEXT NOT NULL DEFAULT 'service', billing_day INTEGER NOT NULL DEFAULT 1, created_at INTEGER, start_date INTEGER NOT NULL DEFAULT 1767268800, end_date INTEGER);`,
  `CREATE TABLE IF NOT EXISTS "transactions" (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, user_id TEXT, date INTEGER NOT NULL, imputed_date INTEGER, amount REAL NOT NULL, category TEXT NOT NULL, description TEXT, presupuesto_id INTEGER, service_id INTEGER, status TEXT DEFAULT 'paid');`,
];

const USER_ID = "e2e-user";

export async function seedE2eDatabase() {
  const dir = path.join(process.cwd(), ".e2e");
  mkdirSync(dir, { recursive: true });
  const dbFile = path.join(dir, "test.db");
  for (const s of ["", "-wal", "-shm"]) {
    rmSync(dbFile + s, { force: true });
  }

  const client = createClient({ url: `file:${dbFile}` });
  for (const stmt of DDL) await client.execute(stmt);

  await client.execute({
    sql: `INSERT INTO "user" (id, name, email, profileType) VALUES (?, ?, ?, ?);`,
    args: [USER_ID, "E2E Tester", "e2e@example.com", "programador"],
  });

  await client.execute({
    sql: `INSERT INTO "clients" (id, user_id, name, status, kind) VALUES
            (1, ?, 'Mermoz', 'active', 'customer'),
            (2, ?, 'Proveedor Cloud', 'active', 'vendor'),
            (3, ?, 'Juan Programador', 'active', 'collaborator');`,
    args: [USER_ID, USER_ID, USER_ID],
  });

  await client.execute({
    sql: `INSERT INTO "presupuestos" (id, user_id, client_id, name, total_amount, type, status)
          VALUES (1, ?, 1, 'Web Mermoz', 1500, 'ingreso', 'activo'),
                 (2, ?, 2, 'Licencia Anual', 120, 'egreso', 'activo'),
                 (3, ?, 3, 'Landing colaborador', 800, 'egreso', 'activo');`,
    args: [USER_ID, USER_ID, USER_ID],
  });

  const jan1 = Math.floor(Date.UTC(2026, 0, 1, 12) / 1000);
  await client.execute({
    sql: `INSERT INTO "recurring_services" (id, user_id, client_id, name, amount, type, billing_day, created_at, start_date, end_date)
          VALUES (1, ?, 1, 'Mantenimiento Web', 50, 'service', 1, ?, ?, NULL);`,
    args: [USER_ID, jan1, jan1],
  });

  // A transaction in the current month so the dashboard shows data by default.
  const now = new Date();
  const dt = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15, 12) / 1000,
  );
  await client.execute({
    sql: `INSERT INTO "transactions" (user_id, date, imputed_date, amount, category, description, presupuesto_id)
          VALUES (?, ?, ?, 500, 'presupuesto', 'Pago Hito 1 E2E', 1),
                 (?, ?, ?, -300, 'presupuesto', 'Adelanto colaborador', 3);`,
    args: [USER_ID, dt, dt, USER_ID, dt, dt],
  });

  client.close();
}
