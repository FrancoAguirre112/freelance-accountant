import fs from "node:fs";
import { createClient } from "@libsql/client";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);

const USER_ID = "fc1c8d2b-8d46-4280-8a0e-0d6a6ff30c1b";
const c = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

const svc = (await c.execute({
  sql: `SELECT id, name, amount, billing_day, type, start_date, end_date
        FROM recurring_services
        WHERE user_id = ? AND lower(name) LIKE '%mantenimiento%';`,
  args: [USER_ID],
})).rows;
for (const s of svc) console.log("service:", JSON.stringify(s));

for (const s of svc) {
  const txs = (await c.execute({
    sql: `SELECT id, date, imputed_date, amount, description FROM transactions
          WHERE service_id = ? AND user_id = ? AND category = 'recurring'
          ORDER BY date ASC;`,
    args: [s.id, USER_ID],
  })).rows;
  console.log(`\n${s.name} → ${txs.length} txns:`);
  for (const t of txs) {
    const d = new Date(Number(t.date) * 1000).toISOString().slice(0, 10);
    const imp = t.imputed_date ? new Date(Number(t.imputed_date) * 1000).toISOString().slice(0, 10) : null;
    console.log(`  id=${t.id} date=${d} imp=${imp ?? "(null)"} amount=${t.amount} desc=${JSON.stringify(t.description)}`);
  }
  // monthly sums
  const byMonth = {};
  for (const t of txs) {
    const dt = new Date(Number(t.imputed_date ?? t.date) * 1000);
    const key = dt.toISOString().slice(0, 7);
    byMonth[key] = (byMonth[key] || 0) + Number(t.amount);
  }
  console.log("  raw sum per month:", byMonth);

  // simulate walker for today = 2026-05-28
  const now = new Date("2026-05-28T12:00:00Z");
  const isPayment = s.type === "payment";
  const fee = Math.abs(Number(s.amount));
  console.log(`  walker (fee=${fee}, type=${s.type}):`);
  for (let offset = -1; offset <= 1; offset++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    const key = d.toISOString().slice(0, 7);
    const raw = byMonth[key] || 0;
    const coverage = isPayment ? -raw : raw;
    const covered = coverage >= fee;
    console.log(`    offset=${offset} month=${key} raw=${raw} coverage=${coverage} covered=${covered}${covered ? "" : " ← would set due"}`);
    if (!covered) {
      const dueMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
      console.log(`      → next due = ${dueMonth.toISOString().slice(0, 7)}-${String(s.billing_day).padStart(2, "0")}`);
      break;
    }
  }
}

c.close();
