// One-shot migration: adds start_date / end_date to recurring_services.
// Idempotent — checks first via PRAGMA table_info and exits cleanly if
// the columns are already present.
//
// Usage: pnpm exec tsx scripts/migrate-recurring-lifecycle.ts
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", quiet: true });

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error(
    "TURSO_DATABASE_URL is not set. Put it in .env.local or export it.",
  );
  process.exit(1);
}

// 2026-01-01T12:00:00Z — matches the user-specified "Jan 1st" default for
// rows whose true start date we don't know.
const DEFAULT_START_SECONDS = 1767268800;

const client = createClient({ url, authToken });

async function columnExists(table: string, column: string) {
  const r = await client.execute(`PRAGMA table_info("${table}");`);
  return r.rows.some(
    (row) => (row as unknown as { name: string }).name === column,
  );
}

async function main() {
  const hasStart = await columnExists("recurring_services", "start_date");
  const hasEnd = await columnExists("recurring_services", "end_date");

  if (hasStart && hasEnd) {
    console.log(
      "[migrate] start_date + end_date already present — nothing to do.",
    );
    return;
  }

  if (!hasStart) {
    console.log("[migrate] adding start_date (NOT NULL, default 2026-01-01)…");
    await client.execute(
      `ALTER TABLE recurring_services ADD COLUMN start_date INTEGER NOT NULL DEFAULT ${DEFAULT_START_SECONDS};`,
    );
  }
  if (!hasEnd) {
    console.log("[migrate] adding end_date (nullable)…");
    await client.execute(
      `ALTER TABLE recurring_services ADD COLUMN end_date INTEGER;`,
    );
  }

  const after = await client.execute(
    `SELECT count(*) AS total,
            sum(CASE WHEN start_date = ${DEFAULT_START_SECONDS} THEN 1 ELSE 0 END) AS as_default,
            sum(CASE WHEN end_date IS NULL THEN 1 ELSE 0 END) AS still_open
       FROM recurring_services;`,
  );
  const row = after.rows[0] as unknown as {
    total: number;
    as_default: number;
    still_open: number;
  };
  console.log(
    `[migrate] done. ${row.total} services total; ${row.as_default} backfilled to 2026-01-01; ${row.still_open} still ongoing (end_date IS NULL).`,
  );
}

main()
  .then(() => client.close())
  .catch((err) => {
    console.error("[migrate] failed:", err);
    client.close();
    process.exit(1);
  });
