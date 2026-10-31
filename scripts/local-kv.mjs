// Minimal Upstash-REST-compatible in-memory KV for local preview only.
//
// The app talks to Upstash over its REST API. Without credentials, room login
// and admin actions fail closed because rate limiting cannot run. This mock
// implements just the commands used by lib/rate-limit.ts, lib/code-store.ts,
// lib/session-version.ts and lib/bank-account.ts: get, set (nx/xx/ex/px/exat/pxat),
// incr, expire, del, hset, hgetall.
//
// Data lives in memory and is lost when the process exits. Never use it in
// production; it has no auth, persistence, or concurrency guarantees.
//
// Usage:
//   npm run dev:kv
//   LOCAL_KV_PORT=8081 npm run dev:kv
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const DEFAULT_PORT = 8081;
const DEFAULT_HOST = "127.0.0.1";

function alive(store, key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry;
}

function numericArg(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function runCommand(store, command) {
  const [name, ...args] = command;
  switch (String(name).toLowerCase()) {
    case "ping":
      return "PONG";
    case "get": {
      const entry = alive(store, args[0]);
      return entry ? entry.value : null;
    }
    case "set": {
      const [key, rawValue, ...opts] = args;
      const existing = alive(store, key);
      const lower = opts.map((option) => String(option).toLowerCase());
      if (lower.includes("nx") && existing) return null;
      if (lower.includes("xx") && !existing) return null;
      let expiresAt = existing?.expiresAt ?? null;
      for (let i = 0; i < opts.length; i += 1) {
        const option = lower[i];
        if (option === "ex") expiresAt = Date.now() + Number(opts[++i]) * 1000;
        else if (option === "px") expiresAt = Date.now() + Number(opts[++i]);
        else if (option === "exat") expiresAt = Number(opts[++i]) * 1000;
        else if (option === "pxat") expiresAt = Number(opts[++i]);
      }
      store.set(key, { value: String(rawValue), expiresAt });
      return "OK";
    }
    case "incr": {
      const key = args[0];
      const entry = alive(store, key);
      const next = (entry ? Number(entry.value) : 0) + 1;
      store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
      return next;
    }
    case "expire": {
      const key = args[0];
      const seconds = numericArg(args[1]);
      const entry = alive(store, key);
      if (!entry || seconds === null) return 0;
      entry.expiresAt = Date.now() + seconds * 1000;
      return 1;
    }
    case "del": {
      let removed = 0;
      for (const key of args) if (store.delete(key)) removed += 1;
      return removed;
    }
    case "hset": {
      const [key, ...pairs] = args;
      const existing = alive(store, key);
      const fields = existing?.fields ?? new Map();
      let added = 0;
      for (let i = 0; i + 1 < pairs.length; i += 2) {
        const field = String(pairs[i]);
        if (!fields.has(field)) added += 1;
        fields.set(field, String(pairs[i + 1]));
      }
      store.set(key, { fields, expiresAt: existing?.expiresAt ?? null });
      return added;
    }
    case "hgetall": {
      const entry = alive(store, args[0]);
      if (!entry?.fields) return [];
      return [...entry.fields.entries()].flat();
    }
    default:
      throw new Error(`Unsupported command: ${name}`);
  }
}

export function createLocalKvServer(store = new Map()) {
  return createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      try {
        const parsed = JSON.parse(body || "[]");
        const isPipeline = Array.isArray(parsed) && Array.isArray(parsed[0]);
        const commands = isPipeline ? parsed : [parsed];
        const results = commands.map((command) => runCommand(store, command));
        res.end(
          JSON.stringify(isPipeline ? results.map((result) => ({ result })) : { result: results[0] }),
        );
      } catch (error) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: String(error?.message ?? error) }));
      }
    });
  });
}

export function startLocalKv({ port = DEFAULT_PORT, host = DEFAULT_HOST } = {}) {
  const server = createLocalKvServer();
  server.listen(port, host, () => {
    console.log(`local-kv (in-memory, dev only) listening on http://${host}:${port}`);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startLocalKv({ port: Number(process.env.LOCAL_KV_PORT ?? DEFAULT_PORT) });
}
