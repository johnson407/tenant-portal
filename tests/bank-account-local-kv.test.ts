import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Redis } from "@upstash/redis";
import { getBankAccount, saveBankAccount } from "@/lib/bank-account";
import { createLocalKvServer } from "../scripts/local-kv.mjs";

const record = {
  bankName: "玉山銀行",
  recipientName: "王小明",
  bankCode: "808",
  accountNo: "0123456789012",
};

let server: Server;

beforeAll(async () => {
  server = createLocalKvServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.KV_REST_API_URL = `http://127.0.0.1:${port}`;
  process.env.KV_REST_API_TOKEN = "local";
});

afterAll(async () => {
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("bank account against the real Upstash client and dev KV", () => {
  it("round-trips digit strings without losing leading zeros or deserializing", async () => {
    await saveBankAccount(record);
    await expect(getBankAccount()).resolves.toEqual(record);
  });

  it("returns null when the hash is missing", async () => {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
    await redis.del("bank:account");

    await expect(getBankAccount()).resolves.toBeNull();
  });
});
