import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

// DDL kept in sync with db/schema.ts. No drizzle migrations exist in the
// repo, so the in-memory SQLite DB is built directly from these statements.
const DDL = [
  `CREATE TABLE "user" (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT,
    email TEXT UNIQUE,
    emailVerified INTEGER,
    image TEXT,
    profileType TEXT
  );`,
  `CREATE TABLE "account" (
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    providerAccountId TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT
  );`,
  `CREATE TABLE "session" (
    sessionToken TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL,
    expires INTEGER NOT NULL
  );`,
  `CREATE TABLE "verificationToken" (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires INTEGER NOT NULL
  );`,
  `CREATE TABLE "clients" (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id TEXT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    kind TEXT DEFAULT 'customer'
  );`,
  `CREATE TABLE "presupuestos" (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id TEXT,
    client_id INTEGER,
    name TEXT NOT NULL,
    total_amount REAL NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'activo'
  );`,
  `CREATE TABLE "recurring_services" (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id TEXT,
    client_id INTEGER,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL DEFAULT 'service',
    billing_day INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER
  );`,
  `CREATE TABLE "transactions" (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id TEXT,
    date INTEGER NOT NULL,
    imputed_date INTEGER,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    presupuesto_id INTEGER,
    service_id INTEGER,
    status TEXT DEFAULT 'paid'
  );`,
];

export interface TestDbHandle {
  db: TestDb;
  client: Client;
  close: () => void;
}

export async function makeTestDb(): Promise<TestDbHandle> {
  const client = createClient({ url: ":memory:" });
  for (const stmt of DDL) {
    await client.execute(stmt);
  }
  const db = drizzle(client, { schema });
  return { db, client, close: () => client.close() };
}
