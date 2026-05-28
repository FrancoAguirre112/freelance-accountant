# Test suite

Full pyramid: **unit · component · integration · snapshot · e2e**.

| Layer | Runner | Location | Command |
|-------|--------|----------|---------|
| Unit | Vitest (node) | `test/unit` | `pnpm test:unit` |
| Integration | Vitest (node) + in-memory libsql | `test/integration` | `pnpm test:integration` |
| Component | Vitest (jsdom) + RTL | `test/component` | `pnpm test:component` |
| Snapshot | Vitest (jsdom) | `test/snapshot` | `pnpm test:snapshot` |
| E2E | Playwright | `e2e/` | `pnpm test:e2e` |

- `pnpm test` runs all Vitest projects (111 tests).
- `pnpm test:coverage` adds a v8 report (`/coverage`) over `lib/`, `app/actions.ts`, `components/`.
- `pnpm test:e2e` seeds a temp DB, runs `next build && next start` on :3100, then drives Chromium.

## How it works

- **Integration** mocks only `@/auth` and `next/cache`; `@/db` is replaced with a
  real libsql DB backed by a per-file temp SQLite file (a temp file, not
  `:memory:`, because `db.transaction()` opens a second connection — an
  in-memory DB is per-connection). Schema lives in `test/helpers/integration-db.ts`
  and must track `db/schema.ts`.
- **Component** uses jsdom; `test/setup.dom.ts` polyfills the DOM APIs Radix/cmdk
  need and globally mocks `sonner`. `next/navigation` is mocked via
  `test/helpers/router-mock.ts`.
- Vitest forces React's development build (`define: process.env.NODE_ENV`) so
  `React.act` is available under React 19.

## E2E auth/DB bypass (prod-inert)

Authenticated flows need a session + DB without Google OAuth or Turso. The
following are **only active when `E2E_TEST_MODE=1`** (set solely by the
Playwright `webServer`); production behaviour is unchanged:

- `lib/test-auth.ts` — fixed test session helper.
- `middleware.ts` — when in E2E, short-circuits **before** importing `@/auth`
  (keeps the Node libsql client out of the edge bundle).
- `app/actions.ts` (`requireUserId`, `setProfileTypeAction`) and `app/page.tsx`
  use the test session instead of `auth()`.
- `db/index.ts` — `file:` / `:memory:` URLs use the Node libsql client; the
  remote Turso URL keeps the edge web client.

The DB is seeded by `e2e/seed.ts` into `./.e2e/test.db` before the build.

## Known limitations

- Because the e2e server runs with the bypass enabled for the whole run, the
  "unauthenticated → /login redirect" path is not e2e-tested; middleware logic
  is covered indirectly (login/onboarding → dashboard redirects) and the real
  auth branch is unit-reasoned. Real Google OAuth is never exercised.
- Coverage % is intentionally focused: business logic (`lib`, `actions.ts`,
  `csv.ts`) is high; purely presentational components are sampled, not
  exhaustively rendered.
