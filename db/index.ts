import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client/web";
import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL?.replace("libsql://", "https://");

const client = createClient({
  url: url!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export const db = drizzle(client, { schema });
