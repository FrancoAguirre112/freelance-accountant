import fs from "node:fs";
import { createClient } from "@libsql/client";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);

const USER_ID = "fc1c8d2b-8d46-4280-8a0e-0d6a6ff30c1b";
const c = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

const before = await c.execute({
  sql: `SELECT id, amount, description FROM transactions
         WHERE id = 48 AND user_id = ?;`,
  args: [USER_ID],
});
console.log("before:", JSON.stringify(before.rows[0] ?? null));

if (!before.rows.length) {
  console.error("no row id=48 for this user — aborting");
  c.close();
  process.exit(1);
}
const cur = Number(before.rows[0].amount);
if (cur === -100) {
  console.log("already -100, nothing to do.");
  c.close();
  process.exit(0);
}
if (cur !== 100) {
  console.error(`unexpected current amount ${cur} (expected +100). Aborting.`);
  c.close();
  process.exit(1);
}

await c.execute({
  sql: `UPDATE transactions SET amount = -100
         WHERE id = 48 AND user_id = ? AND amount = 100;`,
  args: [USER_ID],
});

const after = await c.execute({
  sql: `SELECT id, amount, description FROM transactions WHERE id = 48;`,
});
console.log("after: ", JSON.stringify(after.rows[0] ?? null));
c.close();
