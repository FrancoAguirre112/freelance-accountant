// One-shot migration: adds slackWebhookUrl to the user table.
// Idempotent — checks first and exits cleanly if already present.
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", quiet: true });

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set.");
  process.exit(1);
}

const client = createClient({ url, authToken });

async function main() {
  const info = await client.execute(`PRAGMA table_info("user");`);
  const hasIt = info.rows.some(
    (r) => (r as unknown as { name: string }).name === "slackWebhookUrl",
  );
  if (hasIt) {
    console.log("[migrate] slackWebhookUrl already present — nothing to do.");
    return;
  }
  console.log("[migrate] adding slackWebhookUrl…");
  await client.execute(`ALTER TABLE "user" ADD COLUMN slackWebhookUrl TEXT;`);
  console.log("[migrate] done.");
}

main()
  .then(() => client.close())
  .catch((err) => {
    console.error("[migrate] failed:", err);
    client.close();
    process.exit(1);
  });
