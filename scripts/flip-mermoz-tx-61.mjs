// One-shot: shift Mantenimiento Mermoz id=61's imputedDate back one month
// so the May 4 receipt credits April (paid-in-arrears convention).
import fs from "node:fs";
import { createClient } from "@libsql/client";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);

const USER_ID = "fc1c8d2b-8d46-4280-8a0e-0d6a6ff30c1b";
const TX_ID = 61;

const c = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

const before = (await c.execute({
  sql: `SELECT id, date, imputed_date, amount, description FROM transactions
        WHERE id = ? AND user_id = ?;`,
  args: [TX_ID, USER_ID],
})).rows[0];

if (!before) {
  console.error(`row id=${TX_ID} not found for this user`);
  c.close();
  process.exit(1);
}

const fmt = (sec) =>
  sec == null ? "(null)" : new Date(Number(sec) * 1000).toISOString();
console.log("before:", {
  id: before.id,
  date: fmt(before.date),
  imputed: fmt(before.imputed_date),
  amount: before.amount,
  description: before.description,
});

const curImputed = Number(before.imputed_date);
const realDate = Number(before.date);

// Safety: only proceed if imputed == real date (i.e. this is the case we
// suspect was an oversight at create time and not an explicit user choice).
if (curImputed !== realDate) {
  console.error(
    `imputed_date (${fmt(curImputed)}) differs from date (${fmt(realDate)}) — that looks like an intentional override, refusing to overwrite. Aborting.`,
  );
  c.close();
  process.exit(1);
}

// Target = real date minus 1 calendar month, preserving time-of-day.
const realJs = new Date(realDate * 1000);
const targetJs = new Date(realJs);
targetJs.setUTCMonth(targetJs.getUTCMonth() - 1);
const TARGET = Math.floor(targetJs.getTime() / 1000);
console.log(`shifting imputed_date ${fmt(curImputed)} → ${fmt(TARGET)}`);

await c.execute({
  sql: `UPDATE transactions SET imputed_date = ?
        WHERE id = ? AND user_id = ? AND imputed_date = ?;`,
  args: [TARGET, TX_ID, USER_ID, curImputed],
});

const after = (await c.execute({
  sql: `SELECT id, date, imputed_date, amount, description FROM transactions
        WHERE id = ?;`,
  args: [TX_ID],
})).rows[0];
console.log("after: ", {
  id: after.id,
  date: fmt(after.date),
  imputed: fmt(after.imputed_date),
  amount: after.amount,
  description: after.description,
});

c.close();
