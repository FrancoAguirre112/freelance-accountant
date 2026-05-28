// One-shot migration runner: adds the `kind` column to `clients` on the
// configured Turso DB. Idempotent — checks first and exits cleanly if the
// column already exists.
//
// Usage:
//   pnpm exec tsx scripts/migrate-add-client-kind.ts
//
// Reads TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from .env.local (or the
// process env).
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

const client = createClient({ url, authToken });

async function main() {
  const info = await client.execute(`PRAGMA table_info("clients");`);
  const hasKind = info.rows.some(
    (r) => (r as unknown as { name: string }).name === "kind",
  );

  if (hasKind) {
    console.log("[migrate] `kind` already exists on clients — nothing to do.");
    return;
  }

  console.log("[migrate] adding `kind` column to clients…");
  await client.execute(
    `ALTER TABLE clients ADD COLUMN kind TEXT DEFAULT 'customer';`,
  );

  const after = await client.execute(
    `SELECT count(*) AS total, sum(CASE WHEN kind='customer' THEN 1 ELSE 0 END) AS as_customer FROM clients;`,
  );
  const row = after.rows[0] as unknown as {
    total: number;
    as_customer: number;
  };
  console.log(
    `[migrate] done. ${row.total} clients total; ${row.as_customer} now tagged as 'customer'.`,
  );
}

main()
  .then(() => client.close())
  .catch((err) => {
    console.error("[migrate] failed:", err);
    client.close();
    process.exit(1);
  });
