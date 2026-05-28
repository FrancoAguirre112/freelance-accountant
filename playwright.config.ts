import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const DB_FILE = path.join(process.cwd(), ".e2e", "test.db");

const e2eEnv = {
  E2E_TEST_MODE: "1",
  TURSO_DATABASE_URL: `file:${DB_FILE}`,
  TURSO_AUTH_TOKEN: "e2e",
  AUTH_SECRET: "e2e-secret",
  AUTH_TRUST_HOST: "true",
  AUTH_GOOGLE_ID: "e2e",
  AUTH_GOOGLE_SECRET: "e2e",
  NODE_ENV: "production",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `pnpm exec tsx e2e/seed-run.ts && pnpm exec next build && pnpm exec next start -p ${PORT}`,
    url: BASE_URL,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: e2eEnv,
  },
});
