import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStoredHash, setStoredHash } from "@/lib/code-store";
import { verifyRoomCode } from "@/lib/verify-room-code";

const state = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock("@upstash/redis", () => {
  class Redis {
    url: string;
    token: string;
    constructor(opts: { url: string; token: string }) {
      this.url = opts.url;
      this.token = opts.token;
    }
    async get(key: string) {
      state.get(key);
      return state.storage.get(key) ?? null;
    }
    async set(key: string, value: string, opts?: { nx?: boolean }) {
      state.set(key, value, opts);
      if (opts?.nx && state.storage.has(key)) return null;
      state.storage.set(key, value);
      return "OK";
    }
  }
  return { Redis };
});

function env(overrides: Record<string, string | undefined>) {
  const base: Record<string, string | undefined> = {
    KV_REST_API_URL: "https://example.test",
    KV_REST_API_TOKEN: "token",
    KV_ROOM_KEY_PREFIX: "room:",
    ROOM_CODE_HASH_A: undefined,
    ROOM_CODE_HASH_B: undefined,
    ROOM_CODE_HASH_C: undefined,
    ROOM_CODE_HASH_D: undefined,
    ROOM_CODE_HASH_E: undefined,
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe("code store", () => {
  beforeEach(() => {
    state.storage.clear();
    state.get.mockClear();
    state.set.mockClear();
    vi.stubEnv("SESSION_SECRET", "test-secret");
  });

  it("seeds from env on first lookup and persists the write", async () => {
    env({ ROOM_CODE_HASH_B: "seedHashB" });

    const first = await getStoredHash("b");
    expect(first).toBe("seedHashB");
    expect(state.storage.get("room:b")).toBe("seedHashB");

    state.storage.set("room:b", "changedHash");
    const second = await getStoredHash("b");
    expect(second).toBe("changedHash");
    expect(state.get).toHaveBeenCalled();
  });

  it("reads from KV on second lookup without reseeding", async () => {
    env({ ROOM_CODE_HASH_B: "seedHashB" });
    await getStoredHash("b");
    await setStoredHash("b", "adminResetHash");
    expect(await getStoredHash("b")).toBe("adminResetHash");
  });

  it("yields no code configured when env var is missing", async () => {
    env({});
    await expect(verifyRoomCode("a", "0123456789")).resolves.toMatchObject({
      ok: false,
      reason: "no_code_configured",
    });
  });
});
