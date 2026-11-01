import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  lastOptions: null as { nx?: boolean; ex?: number } | null,
}));

vi.mock("@upstash/redis", () => {
  class Redis {
    constructor(_opts: { url: string; token: string }) {}

    async set(
      key: string,
      value: string,
      options?: { nx?: boolean; ex?: number },
    ) {
      state.lastOptions = options ?? null;
      if (options?.nx && state.storage.has(key)) return null;
      state.storage.set(key, value);
      return "OK";
    }

    async del(key: string) {
      state.storage.delete(key);
      return 1;
    }
  }
  return { Redis };
});

beforeEach(() => {
  state.storage.clear();
  process.env.KV_REST_API_URL = "https://example.test";
  process.env.KV_REST_API_TOKEN = "token";
});

afterEach(() => {
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
});

describe("claim confirmation lock", () => {
  it("acquires a keyed lock and releases it", async () => {
    const { acquireClaimConfirmLock } = await import(
      "@/lib/appfeed/claim-lock"
    );

    const release = await acquireClaimConfirmLock("a", "2026-11");
    expect(typeof release).toBe("function");
    expect(state.storage.has("claim:confirm:a:2026-11")).toBe(true);
    expect(state.lastOptions).toMatchObject({ nx: true, ex: 90 });

    await release?.();
    expect(state.storage.has("claim:confirm:a:2026-11")).toBe(false);
  });

  it("returns null while another confirmation holds the lock", async () => {
    const { acquireClaimConfirmLock } = await import(
      "@/lib/appfeed/claim-lock"
    );

    const release = await acquireClaimConfirmLock("b", "2026-10");
    expect(await acquireClaimConfirmLock("b", "2026-10")).toBeNull();

    await release?.();
    expect(await acquireClaimConfirmLock("b", "2026-10")).not.toBeNull();
  });

  it("keeps rooms and periods independent", async () => {
    const { acquireClaimConfirmLock } = await import(
      "@/lib/appfeed/claim-lock"
    );

    expect(await acquireClaimConfirmLock("a", "2026-11")).not.toBeNull();
    expect(await acquireClaimConfirmLock("b", "2026-11")).not.toBeNull();
    expect(await acquireClaimConfirmLock("a", "2026-10")).not.toBeNull();
  });

  it("fails closed when the KV store is not configured", async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    const { acquireClaimConfirmLock } = await import(
      "@/lib/appfeed/claim-lock"
    );

    await expect(acquireClaimConfirmLock("a", "2026-11")).rejects.toThrow(
      "KV store is not configured",
    );
  });
});
