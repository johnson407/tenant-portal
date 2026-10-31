import { afterEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("@upstash/redis", () => {
  class Redis {
    constructor(_opts: { url: string; token: string }) {}
    async get(key: string) {
      return store.get(key) ?? null;
    }
    async set(key: string, value: string) {
      store.set(key, value);
      return "OK";
    }
  }
  return { Redis };
});

const store = new Map<string, string>();

function env(overrides: Record<string, string | undefined>) {
  const base: Record<string, string | undefined> = {
    KV_REST_API_URL: "https://example.test",
    KV_REST_API_TOKEN: "token",
    KV_ROOM_KEY_PREFIX: "room:",
  };
  const merged = { ...base, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

afterEach(() => {
  store.clear();
  vi.unstubAllEnvs();
});

describe("verifyRoomCode", () => {
  it("accepts the correct code for a seeded room", async () => {
    const plain = "0123456789";
    const { verifyRoomCode } = await import("@/lib/verify-room-code");
    env({ ROOM_CODE_HASH_A: await bcrypt.hash(plain, 4) });
    await expect(verifyRoomCode("a", plain)).resolves.toMatchObject({ ok: true, room: "a" });
  });

  it("rejects a wrong code without logging the submission", async () => {
    const { verifyRoomCode } = await import("@/lib/verify-room-code");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    env({ ROOM_CODE_HASH_A: await bcrypt.hash("0123456789", 4) });
    const result = await verifyRoomCode("a", "9999999999");
    expect(result).toMatchObject({ ok: false, reason: "incorrect_code" });
    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).not.toContain("9999999999");
    expect(logged).not.toContain("0123456789");
    errorSpy.mockRestore();
  });

  it("rejects unknown room letters and wrong-length codes with the same generic input failure", async () => {
    const { verifyRoomCode } = await import("@/lib/verify-room-code");
    env({ ROOM_CODE_HASH_A: await bcrypt.hash("0123456789", 4) });
    await expect(verifyRoomCode("f", "0123456789")).resolves.toMatchObject({
      ok: false,
      reason: "invalid_input",
    });
    await expect(verifyRoomCode("a", "short")).resolves.toMatchObject({
      ok: false,
      reason: "invalid_input",
    });
    await expect(verifyRoomCode("a", "01234567890")).resolves.toMatchObject({
      ok: false,
      reason: "invalid_input",
    });
  });

  it("rejects a room whose hash exists neither in KV nor env", async () => {
    const { verifyRoomCode } = await import("@/lib/verify-room-code");
    env({});
    await expect(verifyRoomCode("e", "0123456789")).resolves.toMatchObject({
      ok: false,
      reason: "no_code_configured",
    });
  });

  it("distinguishes a KV outage from a room with no configured code", async () => {
    const { verifyRoomCode } = await import("@/lib/verify-room-code");
    env({});
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    await expect(verifyRoomCode("a", "0123456789")).resolves.toMatchObject({
      ok: false,
      reason: "unavailable",
    });
  });
});
