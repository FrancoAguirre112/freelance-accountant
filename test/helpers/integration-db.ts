// Shared DB + auth session used by integration tests.
//
// Backed by a unique temp SQLite file (NOT ":memory:"): libsql opens a
// separate connection for db.transaction(), and an in-memory DB is
// per-connection, so transactional actions would see an empty schema. A file
// URL is shared across connections. Schema is applied at module load
// (top-level await); resetDb() wipes rows between tests.
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import * as schema from "@/db/schema";

const DDL = [
  `CREATE TABLE IF NOT EXISTS "user" (id TEXT PRIMARY KEY NOT NULL, name TEXT, email TEXT UNIQUE, emailVerified INTEGER, image TEXT, profileType TEXT, slackWebhookUrl TEXT);`,
  `CREATE TABLE IF NOT EXISTS "clients" (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, user_id TEXT, name TEXT NOT NULL, status TEXT DEFAULT 'active', kind TEXT DEFAULT 'customer');`,
  `CREATE TABLE IF NOT EXISTS "presupuestos" (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, user_id TEXT, client_id INTEGER, name TEXT NOT NULL, total_amount REAL NOT NULL, type TEXT NOT NULL, status TEXT DEFAULT 'activo');`,
  `CREATE TABLE IF NOT EXISTS "recurring_services" (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, user_id TEXT, client_id INTEGER, name TEXT NOT NULL, amount REAL NOT NULL, type TEXT NOT NULL DEFAULT 'service', billing_day INTEGER NOT NULL DEFAULT 1, created_at INTEGER, start_date INTEGER NOT NULL DEFAULT 1767268800, end_date INTEGER);`,
  `CREATE TABLE IF NOT EXISTS "transactions" (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, user_id TEXT, date INTEGER NOT NULL, imputed_date INTEGER, amount REAL NOT NULL, category TEXT NOT NULL, description TEXT, presupuesto_id INTEGER, service_id INTEGER, status TEXT DEFAULT 'paid');`,
];

const dbFile = join(tmpdir(), `fiscus-test-${randomUUID()}.db`);

export const client = createClient({ url: `file:${dbFile}` });
export const testDb = drizzle(client, { schema });

for (const stmt of DDL) {
  await client.execute(stmt);
}

process.on("exit", () => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      rmSync(dbFile + suffix, { force: true });
    } catch {
      /* best effort */
    }
  }
});

export async function applyDDL() {
  // Schema is already applied at module load; kept for call-site clarity.
}

export async function resetDb() {
  for (const t of [
    "transactions",
    "recurring_services",
    "presupuestos",
    "clients",
    "user",
  ]) {
    await client.execute(`DELETE FROM "${t}";`);
  }
  await client.execute(`DELETE FROM sqlite_sequence;`).catch(() => {});
}

// --- Auth session control for vi.mock("@/auth") ---
let sessionUserId: string | null = null;

export function setAuthUser(id: string | null) {
  sessionUserId = id;
}

export async function getMockSession() {
  if (!sessionUserId) return null;
  return { user: { id: sessionUserId } };
}
