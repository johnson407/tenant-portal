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

const LEGACY_CODE = "0123456789";

afterEach(() => {
  store.clear();
  vi.unstubAllEnvs();
});

describe("verifyRoomCode", () => {
  it("accepts a correct 4-character password", async () => {
    const { verifyRoomCode } = await import("@/lib/verify-room-code");
    env({ ROOM_CODE_HASH_A: await bcrypt.hash("Ab12", 4) });
    await expect(verifyRoomCode("a", "Ab12")).resolves.toMatchObject({ ok: true, room: "a" });
  });

  it("accepts a correct 64-character password", async () => {
    const { verifyRoomCode } = await import("@/lib/verify-room-code");
    const password = "A".repeat(64);
    env({ ROOM_CODE_HASH_B: await bcrypt.hash(password, 4) });
    await expect(verifyRoomCode("b", password)).resolves.toMatchObject({ ok: true, room: "b" });
  });

  it("accepts a legacy 10-character code for a seeded room", async () => {
    const { verifyRoomCode } = await import("@/lib/verify-room-code");
    env({ ROOM_CODE_HASH_A: await bcrypt.hash(LEGACY_CODE, 4) });
    await expect(verifyRoomCode("a", LEGACY_CODE)).resolves.toMatchObject({ ok: true, room: "a" });
  });

  it("rejects a wrong password without logging the submission", async () => {
    const { verifyRoomCode } = await import("@/lib/verify-room-code");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    env({ ROOM_CODE_HASH_A: await bcrypt.hash(LEGACY_CODE, 4) });
    const result = await verifyRoomCode("a", "9999999999");
    expect(result).toMatchObject({ ok: false, reason: "incorrect_code" });
    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).not.toContain("9999999999");
    expect(logged).not.toContain(LEGACY_CODE);
    errorSpy.mockRestore();
  });

  it("rejects unknown room letters and out-of-policy passwords with the same generic input failure", async () => {
    const { verifyRoomCode } = await import("@/lib/verify-room-code");
    env({ ROOM_CODE_HASH_A: await bcrypt.hash(LEGACY_CODE, 4) });
    await expect(verifyRoomCode("f", LEGACY_CODE)).resolves.toMatchObject({
      ok: false,
      reason: "invalid_input",
    });
    for (const bad of ["Ab1", "A".repeat(65), "Ab1-", "ABCDEFGH-J"]) {
      await expect(verifyRoomCode("a", bad)).resolves.toMatchObject({
        ok: false,
        reason: "invalid_input",
      });
    }
  });

  it("rejects a room whose hash exists neither in KV nor env", async () => {
    const { verifyRoomCode } = await import("@/lib/verify-room-code");
    env({ ROOM_CODE_HASH_E: undefined });
    await expect(verifyRoomCode("e", LEGACY_CODE)).resolves.toMatchObject({
      ok: false,
      reason: "no_code_configured",
    });
  });

  it("distinguishes a KV outage from a room with no configured code", async () => {
    const { verifyRoomCode } = await import("@/lib/verify-room-code");
    env({ ROOM_CODE_HASH_A: undefined });
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    await expect(verifyRoomCode("a", LEGACY_CODE)).resolves.toMatchObject({
      ok: false,
      reason: "unavailable",
    });
  });
});
