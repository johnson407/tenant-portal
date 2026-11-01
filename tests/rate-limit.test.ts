import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  storage: new Map<string, number | string>(),
}));

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
        (typeof state.storage.get(key) === "number"
          ? (state.storage.get(key) as number)
          : 0) + 1;
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

let t = 1_000_000;

function setEnv(): void {
  process.env.KV_REST_API_URL = "https://example.test";
  process.env.KV_REST_API_TOKEN = "token";
}

beforeEach(() => {
  state.storage.clear();
  t = 1_000_000;
  setEnv();
});

afterEach(() => {
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  vi.restoreAllMocks();
});

describe("rate limit lib", () => {
  it("encodes exponential backoff after maxAttempts", async () => {
    const { backoffSecondsFor, LOGIN_RATE_BUCKET } = await import(
      "@/lib/rate-limit"
    );
    expect(backoffSecondsFor(10, LOGIN_RATE_BUCKET)).toBe(0);
    expect(backoffSecondsFor(11, LOGIN_RATE_BUCKET)).toBe(60);
    expect(backoffSecondsFor(12, LOGIN_RATE_BUCKET)).toBe(120);
    expect(backoffSecondsFor(99, LOGIN_RATE_BUCKET)).toBe(30 * 60);
  });

  it("defines the repair submit and completion buckets", async () => {
    const {
      REPAIR_DONE_RATE_BUCKET,
      REPAIR_SUBMIT_RATE_BUCKET,
    } = await import("@/lib/rate-limit");

    expect(REPAIR_SUBMIT_RATE_BUCKET).toEqual({
      prefix: "ratelimit:repair-submit",
      maxAttempts: 10,
      windowSeconds: 15 * 60,
    });
    expect(REPAIR_DONE_RATE_BUCKET).toEqual({
      prefix: "ratelimit:repair-done",
      maxAttempts: 60,
      windowSeconds: 15 * 60,
    });
  });

  it("defines the claim confirmation bucket", async () => {
    const { CLAIM_CONFIRM_RATE_BUCKET } = await import("@/lib/rate-limit");

    expect(CLAIM_CONFIRM_RATE_BUCKET).toEqual({
      prefix: "ratelimit:claim-confirm",
      maxAttempts: 60,
      windowSeconds: 15 * 60,
    });
  });
});

describe("claim confirmation limit", () => {
  it("allows 60 confirmations and blocks the 61st", async () => {
    const { consumeAttempt, CLAIM_CONFIRM_RATE_BUCKET } = await import(
      "@/lib/rate-limit"
    );

    for (let index = 0; index < 60; index += 1) {
      expect(
        await consumeAttempt(CLAIM_CONFIRM_RATE_BUCKET, ["ip:1.2.3.4"], t),
      ).toMatchObject({ allowed: true });
    }

    const blocked = await consumeAttempt(
      CLAIM_CONFIRM_RATE_BUCKET,
      ["ip:1.2.3.4"],
      t,
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it("fails closed when the KV store is not configured", async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    const { consumeAttempt, CLAIM_CONFIRM_RATE_BUCKET } = await import(
      "@/lib/rate-limit"
    );

    await expect(
      consumeAttempt(CLAIM_CONFIRM_RATE_BUCKET, ["ip:1.2.3.4"], t),
    ).rejects.toThrow("KV store is not configured");
  });
});

describe("repair submission limit", () => {
  it("allows 10 submissions and blocks the 11th", async () => {
    const { consumeAttempt, REPAIR_SUBMIT_RATE_BUCKET } = await import(
      "@/lib/rate-limit"
    );

    for (let index = 0; index < 10; index += 1) {
      expect(
        await consumeAttempt(
          REPAIR_SUBMIT_RATE_BUCKET,
          ["ip:1.2.3.4", "room:a"],
          t,
        ),
      ).toMatchObject({ allowed: true });
    }

    const blocked = await consumeAttempt(
      REPAIR_SUBMIT_RATE_BUCKET,
      ["ip:1.2.3.4", "room:a"],
      t,
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it("isolates both the IP key and the room key", async () => {
    const { consumeAttempt, REPAIR_SUBMIT_RATE_BUCKET } = await import(
      "@/lib/rate-limit"
    );

    for (let index = 0; index <= 10; index += 1) {
      await consumeAttempt(
        REPAIR_SUBMIT_RATE_BUCKET,
        ["ip:1.2.3.4", "room:a"],
        t,
      );
    }

    expect(
      await consumeAttempt(
        REPAIR_SUBMIT_RATE_BUCKET,
        ["ip:9.9.9.9", "room:b"],
        t,
      ),
    ).toMatchObject({ allowed: true });
    expect(
      await consumeAttempt(
        REPAIR_SUBMIT_RATE_BUCKET,
        ["ip:1.2.3.4", "room:b"],
        t,
      ),
    ).toMatchObject({ allowed: false });
    expect(
      await consumeAttempt(
        REPAIR_SUBMIT_RATE_BUCKET,
        ["ip:9.9.9.9", "room:a"],
        t,
      ),
    ).toMatchObject({ allowed: false });
  });

  it("fails closed when the KV store is not configured", async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    const { consumeAttempt, REPAIR_SUBMIT_RATE_BUCKET } = await import(
      "@/lib/rate-limit"
    );

    await expect(
      consumeAttempt(REPAIR_SUBMIT_RATE_BUCKET, ["ip:1.2.3.4"], t),
    ).rejects.toThrow("KV store is not configured");
  });

  it("fails closed when there is no key", async () => {
    const { consumeAttempt, REPAIR_SUBMIT_RATE_BUCKET } = await import(
      "@/lib/rate-limit"
    );

    await expect(
      consumeAttempt(REPAIR_SUBMIT_RATE_BUCKET, [], t),
    ).rejects.toThrow("KV store is not configured");
  });
});

describe("repair completion limit", () => {
  it("allows 60 completions and blocks the 61st", async () => {
    const { consumeAttempt, REPAIR_DONE_RATE_BUCKET } = await import(
      "@/lib/rate-limit"
    );

    for (let index = 0; index < 60; index += 1) {
      expect(
        await consumeAttempt(REPAIR_DONE_RATE_BUCKET, ["ip:1.2.3.4"], t),
      ).toMatchObject({ allowed: true });
    }

    const blocked = await consumeAttempt(
      REPAIR_DONE_RATE_BUCKET,
      ["ip:1.2.3.4"],
      t,
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it("does not block a different admin IP", async () => {
    const { consumeAttempt, REPAIR_DONE_RATE_BUCKET } = await import(
      "@/lib/rate-limit"
    );

    for (let index = 0; index <= 60; index += 1) {
      await consumeAttempt(REPAIR_DONE_RATE_BUCKET, ["ip:1.2.3.4"], t);
    }

    expect(
      await consumeAttempt(REPAIR_DONE_RATE_BUCKET, ["ip:9.9.9.9"], t),
    ).toMatchObject({ allowed: true });
  });

  it("fails closed when the KV store is not configured", async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    const { consumeAttempt, REPAIR_DONE_RATE_BUCKET } = await import(
      "@/lib/rate-limit"
    );

    await expect(
      consumeAttempt(REPAIR_DONE_RATE_BUCKET, ["ip:1.2.3.4"], t),
    ).rejects.toThrow("KV store is not configured");
  });
});
