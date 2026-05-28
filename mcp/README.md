# Fiscus MCP server

Exposes the freelance-accountant data layer as a Model Context Protocol
server so Claude can read and mutate the same Turso DB the web app uses.

- Transport: **stdio** (works in Claude Code, Claude Desktop, the MCP inspector).
- Scope: every operation is filtered to a single `userId`.
- Tech: `@modelcontextprotocol/sdk` + Drizzle + libsql, run via `tsx`.

## Tools (19)

| Group | Tools |
|-------|-------|
| Clients | `list_clients`, `create_client`, `update_client`, `delete_client` |
| Presupuestos | `list_presupuestos`, `create_presupuesto`, `update_presupuesto`, `delete_presupuesto` |
| Recurrentes | `list_recurring`, `create_recurring`, `update_recurring`, `delete_recurring` |
| Transactions | `list_transactions`, `create_transaction`, `update_transaction`, `delete_transaction` |
| Analytics | `get_dashboard_summary`, `get_recurring_coverage` |
| Diagnostics | `whoami` |

`create_transaction` mirrors the app behavior: amounts linked to an `egreso`
presupuesto are auto-negated, and the presupuesto status is rechecked
(`activo`/`finalizado`) on create / update / delete.

## Configure once

Required env (the server reads these on startup):

```
TURSO_DATABASE_URL   # libsql://… or file:./local.db or :memory:
TURSO_AUTH_TOKEN     # Turso token (omit for file:/memory:)
MCP_USER_ID          # optional — auto-detected if your DB has exactly one user
```

A starter [`.mcp.json`](../.mcp.json) is committed in the project root that
forwards these from the parent process's environment.

## Wire it to Claude

### Claude Code (CLI)

If you launch `claude` from the project directory, it picks up
[`.mcp.json`](../.mcp.json) automatically — just export the env vars in the
same shell:

```bash
export TURSO_DATABASE_URL=...   # the same value you have in .env.local
export TURSO_AUTH_TOKEN=...
# optional, only if you have multiple users:
# export MCP_USER_ID=...
claude
```

Or register it explicitly:

```bash
claude mcp add fiscus -- pnpm exec tsx mcp/server.ts
```

### Claude Desktop

Edit `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "fiscus": {
      "command": "pnpm",
      "args": ["exec", "tsx", "mcp/server.ts"],
      "cwd": "C:\\Users\\franc\\OneDrive\\Escritorio\\Codigo\\freelance-accountant",
      "env": {
        "TURSO_DATABASE_URL": "libsql://your-db.turso.io",
        "TURSO_AUTH_TOKEN": "eyJ…",
        "MCP_USER_ID": "your-user-id"
      }
    }
  }
}
```

Restart Claude Desktop; "fiscus" will appear in the connected tools list.

## Smoke test

```bash
TURSO_DATABASE_URL=file:./.e2e/test.db MCP_USER_ID=e2e-user node mcp/smoke-test.mjs
```

Expected output:

```
[fiscus-mcp] connected (user=e2e-user)
initialize ok: { name: 'fiscus', version: '0.1.0' }
tools: list_clients, create_client, … , whoami
whoami: { "userId": "e2e-user" }
list_clients: 2 rows
```

## Finding your `MCP_USER_ID`

Run the app, then query the DB:

```sql
select id, email, profileType from "user";
```

Pass the returned `id` as `MCP_USER_ID`. With a single-user DB you can leave
it unset — the server auto-detects.

## Safety notes

- Tools that mutate (create/update/delete) write directly to your production
  Turso DB if that's what `TURSO_DATABASE_URL` points to. Point it at a copy
  or a local file (`file:./scratch.db`) while you're trying things out.
- `delete_client` refuses if linked presupuestos/recurring services exist —
  same guard the web app enforces.
- `delete_presupuesto` / `delete_recurring` keep linked transactions and
  null out the foreign key.
