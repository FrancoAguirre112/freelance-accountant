import { drizzle } from "drizzle-orm/libsql";
import { createClient as createWebClient } from "@libsql/client/web";
import * as schema from "./schema";

const rawUrl = process.env.TURSO_DATABASE_URL ?? "";

// Local file / in-memory URLs (only used by e2e) need the Node libsql
// client. The specifier is concatenated so it is NOT bundled into the edge
// middleware build — production always takes the static web-client path
// below, keeping prod behaviour identical.
const isLocal = rawUrl.startsWith("file:") || rawUrl === ":memory:";

const client = isLocal
  ? (await import("@libsql" + "/client")).createClient({ url: rawUrl })
  : createWebClient({
      url: rawUrl.replace("libsql://", "https://"),
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });

export const db = drizzle(client, { schema });
