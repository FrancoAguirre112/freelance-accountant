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

const svc = await c.execute({
  sql: `SELECT id, name, amount, billing_day, start_date, end_date,
               (SELECT name FROM clients WHERE id = recurring_services.client_id) AS client_name
        FROM recurring_services
        WHERE user_id = ? AND lower(name) LIKE '%claude%';`,
  args: [USER_ID],
});
for (const r of svc.rows) console.log("service:", JSON.stringify(r));

if (svc.rows.length) {
  const id = svc.rows[0].id;
  const tx = await c.execute({
    sql: `SELECT id, date, imputed_date, amount, description, category
          FROM transactions WHERE service_id = ?
          ORDER BY date DESC LIMIT 12;`,
    args: [id],
  });
  console.log(`\n${tx.rows.length} transactions linked:`);
  for (const r of tx.rows) {
    const d = new Date(Number(r.date) * 1000).toISOString().slice(0, 10);
    const imp = r.imputed_date
      ? new Date(Number(r.imputed_date) * 1000).toISOString().slice(0, 10)
      : null;
    console.log(
      `  id=${r.id} date=${d} imputed=${imp ?? "(null)"} amount=${r.amount} desc=${JSON.stringify(r.description)}`,
    );
  }
}

c.close();
