-- Adds an entity-kind tag to clients so customers vs. collaborators
-- (e.g. a contractor you pay) vs. vendors can be distinguished.
--
-- Apply against your Turso DB once:
--   turso db shell <your-db> < migrations/0001_add_client_kind.sql
-- or with drizzle-kit:
--   pnpm exec drizzle-kit push

ALTER TABLE clients ADD COLUMN kind TEXT DEFAULT 'customer';
