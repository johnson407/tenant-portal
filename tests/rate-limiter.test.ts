import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ storage: new Map<string, number | string>() }));

vi.mock("@upstash/redis", () => {
  class Redis {
    constructor(_opts: { url: string; token: string }) {}
    async get(key: string) {
      return state.storage.get(key) ?? null;
    }
    async set(key: string, value: number | string, opts?: { ex?: number }) {
      void opts;
      state.storage.set(key, value);
      return "OK";
    }
    async incr(key: string) {
      const next =
        (typeof state.storage.get(key) === "number" ? (state.storage.get(key) as number) : 0) + 1;
      state.storage.set(key, next);
      return next;
    }
    async expire(key: string, seconds: number) {
      void key;
      void seconds;
      return 1;
    }
    async del(...keys: string[]) {
      let removed = 0;
      for (const key of keys) {
        if (state.storage.delete(key)) removed += 1;
      }
      return removed;
    }
  }
  return { Redis };
});

const BUCKET = {
  prefix: "ratelimit:test",
  maxAttempts: 10,
  windowSeconds: 900,
};

let t = 1_000_000;

function env() {
  process.env.KV_REST_API_URL = "https://example.test";
  process.env.KV_REST_API_TOKEN = "token";
}

beforeEach(() => {
  state.storage.clear();
  t = 1_000_000;
  env();
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
});

describe("consumeAttempt", () => {
  it("allows exactly maxAttempts submissions and blocks the next one", async () => {
    const { consumeAttempt } = await import("@/lib/rate-limit");
    for (let i = 0; i < BUCKET.maxAttempts; i++) {
      expect(await consumeAttempt(BUCKET, ["ip:1.2.3.4"], t)).toMatchObject({ allowed: true });
    }
    const blocked = await consumeAttempt(BUCKET, ["ip:1.2.3.4"], t);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it("does not let a concurrent burst exceed the attempt limit", async () => {
    const { consumeAttempt } = await import("@/lib/rate-limit");
    const decisions = await Promise.all(
      Array.from({ length: 25 }, () => consumeAttempt(BUCKET, ["ip:1.2.3.4"], t)),
    );
    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(BUCKET.maxAttempts);
  });

  it("blocks on any exceeded key, so one room's attempts cannot exhaust another room", async () => {
    const { consumeAttempt } = await import("@/lib/rate-limit");
    for (let i = 0; i <= BUCKET.maxAttempts; i++) {
      await consumeAttempt(BUCKET, ["ip:1.2.3.4", "room:a"], t);
    }

    const roomB = await consumeAttempt(BUCKET, ["ip:9.9.9.9", "room:b"], t);
    expect(roomB.allowed).toBe(true);

    const sameIpOtherRoom = await consumeAttempt(BUCKET, ["ip:1.2.3.4", "room:b"], t);
    expect(sameIpOtherRoom.allowed).toBe(false);
  });

  it("doubles the backoff on repeated failures and clears after the lockout window", async () => {
    const { consumeAttempt, clearRateLimit } = await import("@/lib/rate-limit");
    for (let i = 0; i < BUCKET.maxAttempts; i++) {
      await consumeAttempt(BUCKET, ["ip:1.2.3.4"], t);
    }
    expect((await consumeAttempt(BUCKET, ["ip:1.2.3.4"], t)).retryAfterSeconds).toBe(60);
    expect((await consumeAttempt(BUCKET, ["ip:1.2.3.4"], t + 61_000)).retryAfterSeconds).toBe(
      120,
    );

    await clearRateLimit(BUCKET, ["ip:1.2.3.4"]);
    expect(await consumeAttempt(BUCKET, ["ip:1.2.3.4"], t + 61_000)).toMatchObject({
      allowed: true,
      retryAfterSeconds: null,
    });
  });

  it("fails closed when the KV store is not configured", async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    const { consumeAttempt } = await import("@/lib/rate-limit");
    await expect(consumeAttempt(BUCKET, ["ip:1.2.3.4"], t)).rejects.toThrow(
      "KV store is not configured",
    );
  });

  it("fails closed when there is no key to limit on", async () => {
    const { consumeAttempt } = await import("@/lib/rate-limit");
    await expect(consumeAttempt(BUCKET, [], t)).rejects.toThrow("KV store is not configured");
  });
});
