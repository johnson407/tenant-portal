import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLocalKvServer } from "../scripts/local-kv.mjs";

let server: Server;
let baseUrl: string;

async function send(body: unknown) {
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await response.json();
}

beforeAll(async () => {
  server = createLocalKvServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("local KV mock", () => {
  it("answers a single command in Upstash REST shape", async () => {
    expect(await send(["incr", "counter"])).toEqual({ result: 1 });
    expect(await send(["get", "counter"])).toEqual({ result: "1" });
  });

  it("supports pipelined commands", async () => {
    const response = await send([
      ["set", "pipelines", "yes"],
      ["get", "pipelines"],
    ]);
    expect(response).toEqual([{ result: "OK" }, { result: "yes" }]);
  });

  it("honours SET NX and DEL", async () => {
    expect(await send(["set", "nx", "first", "nx"])).toEqual({ result: "OK" });
    expect(await send(["set", "nx", "second", "nx"])).toEqual({ result: null });
    expect(await send(["get", "nx"])).toEqual({ result: "first" });
    expect(await send(["del", "nx"])).toEqual({ result: 1 });
    expect(await send(["get", "nx"])).toEqual({ result: null });
  });

  it("expires keys after PX", async () => {
    await send(["set", "short", "lived", "px", 10]);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(await send(["get", "short"])).toEqual({ result: null });
  });

  it("supports hash writes and reads", async () => {
    expect(await send(["hset", "bank:account", "bankName", "玉山銀行", "bankCode", "808"])).toEqual({
      result: 2,
    });
    expect(await send(["hgetall", "bank:account"])).toEqual({
      result: ["bankName", "玉山銀行", "bankCode", "808"],
    });
    expect(await send(["hset", "bank:account", "bankName", "國泰世華"])).toEqual({ result: 0 });
    expect(await send(["hgetall", "bank:account"])).toEqual({
      result: ["bankName", "國泰世華", "bankCode", "808"],
    });
    expect(await send(["hgetall", "missing:hash"])).toEqual({ result: [] });
    expect(await send(["del", "bank:account"])).toEqual({ result: 1 });
    expect(await send(["hgetall", "bank:account"])).toEqual({ result: [] });
  });

  it("rejects unsupported commands", async () => {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(["flushall"]),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("flushall") });
  });
});
