// Tiny MCP smoke test: spawn the server, run initialize → tools/list → whoami,
// print summaries, exit. Used only by the test author; not part of CI.
import { spawn } from "node:child_process";

const proc = spawn("pnpm", ["exec", "tsx", "mcp/server.ts"], {
  env: {
    ...process.env,
    TURSO_DATABASE_URL: "file:./.e2e/test.db",
    MCP_USER_ID: "e2e-user",
  },
  stdio: ["pipe", "pipe", "inherit"],
  shell: true,
});

let buf = "";
const pending = new Map();
proc.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  let nl;
  while ((nl = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

let nextId = 1;
function send(method, params) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    proc.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n",
    );
  });
}
function notify(method, params) {
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

(async () => {
  const init = await send("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0" },
  });
  console.log("initialize ok:", init.result.serverInfo);
  notify("notifications/initialized");

  const list = await send("tools/list", {});
  console.log("tools:", list.result.tools.map((t) => t.name).join(", "));

  const who = await send("tools/call", {
    name: "whoami",
    arguments: {},
  });
  console.log("whoami:", who.result.content[0].text);

  const clients = await send("tools/call", {
    name: "list_clients",
    arguments: {},
  });
  const parsed = JSON.parse(clients.result.content[0].text);
  console.log(`list_clients: ${parsed.length} rows`);

  const collabs = await send("tools/call", {
    name: "list_clients",
    arguments: { kind: "collaborator" },
  });
  console.log("collaborators:", collabs.result.content[0].text);

  const owed = await send("tools/call", {
    name: "get_outstanding_per_entity",
    arguments: { kind: "collaborator" },
  });
  console.log("outstanding:", owed.result.content[0].text);

  proc.kill();
  process.exit(0);
})();
