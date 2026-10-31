import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ storage: new Map<string, number>() }));

vi.mock("@upstash/redis", () => {
  class Redis {
    constructor(_opts: { url: string; token: string }) {}
    async get(key: string) {
      return state.storage.get(key) ?? null;
    }
    async incr(key: string) {
      const next = (state.storage.get(key) ?? 0) + 1;
      state.storage.set(key, next);
      return next;
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
  delete process.env.KV_ROOM_KEY_PREFIX;
});

describe("room session version", () => {
  it("defaults to zero when no reset has happened", async () => {
    const { getRoomSessionVersion } = await import("@/lib/session-version");
    await expect(getRoomSessionVersion("a")).resolves.toBe(0);
  });

  it("increments on reset so previously issued sessions become stale", async () => {
    const { getRoomSessionVersion, bumpRoomSessionVersion } = await import(
      "@/lib/session-version"
    );
    await expect(bumpRoomSessionVersion("b")).resolves.toBe(1);
    await expect(getRoomSessionVersion("b")).resolves.toBe(1);
    await expect(bumpRoomSessionVersion("b")).resolves.toBe(2);
  });

  it("fails closed when the KV store is not configured", async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    const { getRoomSessionVersion } = await import("@/lib/session-version");
    await expect(getRoomSessionVersion("a")).rejects.toThrow("KV store is not configured");
  });
});
