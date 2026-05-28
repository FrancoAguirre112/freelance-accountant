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

const c = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});
const r = await c.execute(
  `SELECT u.id, u.email, u.name,
          (SELECT count(*) FROM clients WHERE user_id = u.id) AS clients_count
   FROM "user" u ORDER BY clients_count DESC;`,
);
for (const row of r.rows) console.log(JSON.stringify(row));
c.close();
