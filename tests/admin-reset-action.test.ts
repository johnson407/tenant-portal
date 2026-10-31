import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionClaims: vi.fn(),
  setStoredHash: vi.fn(),
  bumpRoomSessionVersion: vi.fn(),
  consumeAttempt: vi.fn(),
  clearRateLimit: vi.fn(),
  clientIpKeys: vi.fn(),
  hash: vi.fn(),
}));

vi.mock("@/lib/session-cookies", () => ({
  getSessionClaims: mocks.getSessionClaims,
}));

vi.mock("@/lib/code-store", () => ({
  PASSWORD_HASH_COST: 12,
  setStoredHash: mocks.setStoredHash,
}));

vi.mock("@/lib/session-version", () => ({
  bumpRoomSessionVersion: mocks.bumpRoomSessionVersion,
}));

vi.mock("@/lib/rate-limit", () => ({
  ADMIN_RESET_RATE_BUCKET: { prefix: "ratelimit:admin-reset", maxAttempts: 10, windowSeconds: 900 },
  consumeAttempt: mocks.consumeAttempt,
  clearRateLimit: mocks.clearRateLimit,
}));

vi.mock("@/lib/admin-auth", () => ({
  clientIpKeys: mocks.clientIpKeys,
}));

vi.mock("bcryptjs", () => ({
  default: { hash: mocks.hash },
}));

import { resetRoomCodeAction } from "@/app/[lang]/admin/actions";
import { GENERIC_ADMIN_RESET_ERROR } from "@/app/[lang]/admin/login-state";

function form(room: string, code: string): FormData {
  const data = new FormData();
  data.set("room", room);
  data.set("code", code);
  return data;
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getSessionClaims.mockResolvedValue({ role: "admin", exp: 1 });
  mocks.consumeAttempt.mockResolvedValue({ allowed: true, retryAfterSeconds: null });
  mocks.clientIpKeys.mockResolvedValue(["ip:203.0.113.9"]);
  mocks.hash.mockResolvedValue("bcrypt-hash");
  mocks.setStoredHash.mockResolvedValue(undefined);
  mocks.bumpRoomSessionVersion.mockResolvedValue(1);
});

describe("resetRoomCodeAction authorization", () => {
  it("returns a locale-independent invalid-room code without writing", async () => {
    const result = await resetRoomCodeAction("en", { status: "idle" }, form("z", "ABCDEFGHIJ"));

    expect(result).toEqual({ status: "error", message: "invalid-room" });
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.setStoredHash).not.toHaveBeenCalled();
    expect(mocks.consumeAttempt).not.toHaveBeenCalled();
  });

  it("accepts a valid locale on a successful reset", async () => {
    const result = await resetRoomCodeAction("en", { status: "idle" }, form("b", "ABCDEFGHIJ"));

    expect(result).toEqual({ status: "success", room: "b", code: "ABCDEFGHIJ" });
  });

  it("rejects a tenant session without changing the stored hash or session version", async () => {
    mocks.getSessionClaims.mockResolvedValue({ role: "tenant", room: "a", v: 0, exp: 1 });

    const result = await resetRoomCodeAction("zh-TW", { status: "idle" }, form("b", "ABCDEFGHIJ"));

    expect(result).toEqual({ status: "error", message: GENERIC_ADMIN_RESET_ERROR });
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.setStoredHash).not.toHaveBeenCalled();
    expect(mocks.bumpRoomSessionVersion).not.toHaveBeenCalled();
  });

  it("rejects an anonymous caller without changing the stored hash or session version", async () => {
    mocks.getSessionClaims.mockResolvedValue(null);

    const result = await resetRoomCodeAction("zh-TW", { status: "idle" }, form("b", "ABCDEFGHIJ"));

    expect(result).toEqual({ status: "error", message: GENERIC_ADMIN_RESET_ERROR });
    expect(mocks.setStoredHash).not.toHaveBeenCalled();
    expect(mocks.bumpRoomSessionVersion).not.toHaveBeenCalled();
  });

  it("resets the code and revokes existing tenant sessions for that room", async () => {
    const result = await resetRoomCodeAction("zh-TW", { status: "idle" }, form("b", "ABCDEFGHIJ"));

    expect(result).toEqual({ status: "success", room: "b", code: "ABCDEFGHIJ" });
    expect(mocks.setStoredHash).toHaveBeenCalledWith("b", "bcrypt-hash");
    expect(mocks.bumpRoomSessionVersion).toHaveBeenCalledWith("b");
  });

  it("returns a generic error and no plaintext if the KV write fails", async () => {
    mocks.setStoredHash.mockRejectedValue(new Error("kv down"));

    const result = await resetRoomCodeAction("zh-TW", { status: "idle" }, form("b", "ABCDEFGHIJ"));

    expect(result).toEqual({ status: "error", message: GENERIC_ADMIN_RESET_ERROR });
  });

  it("returns a generic error without hashing or writing when the rate limit denies the reset", async () => {
    mocks.consumeAttempt.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });

    const result = await resetRoomCodeAction("en", { status: "idle" }, form("b", "ABCDEFGHIJ"));

    expect(result).toEqual({ status: "error", message: GENERIC_ADMIN_RESET_ERROR });
    expect(mocks.consumeAttempt).toHaveBeenCalledTimes(1);
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.setStoredHash).not.toHaveBeenCalled();
    expect(mocks.bumpRoomSessionVersion).not.toHaveBeenCalled();
  });

  it("consumes an attempt for a non-admin caller even when the room is invalid", async () => {
    mocks.getSessionClaims.mockResolvedValue({ role: "tenant", room: "a", v: 0, exp: 1 });

    const result = await resetRoomCodeAction("zh-TW", { status: "idle" }, form("z", "ABCDEFGHIJ"));

    expect(result).toEqual({ status: "error", message: GENERIC_ADMIN_RESET_ERROR });
    expect(mocks.consumeAttempt).toHaveBeenCalledTimes(1);
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.setStoredHash).not.toHaveBeenCalled();
    expect(mocks.bumpRoomSessionVersion).not.toHaveBeenCalled();
  });
});

describe("resetRoomCodeAction password policy", () => {
  it("accepts a 4-character password verbatim", async () => {
    const result = await resetRoomCodeAction("en", { status: "idle" }, form("b", "Ab12"));

    expect(result).toEqual({ status: "success", room: "b", code: "Ab12" });
    expect(mocks.hash).toHaveBeenCalledWith("Ab12", 12);
    expect(mocks.setStoredHash).toHaveBeenCalledWith("b", "bcrypt-hash");
  });

  it("accepts a 64-character password verbatim", async () => {
    const password = "A".repeat(64);
    const result = await resetRoomCodeAction("en", { status: "idle" }, form("b", password));

    expect(result).toEqual({ status: "success", room: "b", code: password });
    expect(mocks.hash).toHaveBeenCalledWith(password, 12);
    expect(mocks.setStoredHash).toHaveBeenCalledWith("b", "bcrypt-hash");
  });

  it.each(["Ab1", "A".repeat(65), "Ab1-", "   "])(
    "rejects the out-of-policy password %s without writing",
    async (password) => {
      const result = await resetRoomCodeAction("en", { status: "idle" }, form("b", password));

      expect(result).toEqual({ status: "error", message: "invalid-password" });
      expect(mocks.hash).not.toHaveBeenCalled();
      expect(mocks.setStoredHash).not.toHaveBeenCalled();
      expect(mocks.bumpRoomSessionVersion).not.toHaveBeenCalled();
      expect(mocks.consumeAttempt).not.toHaveBeenCalled();
    },
  );

  it("generates a 10-character alphanumeric password when the field is blank", async () => {
    const result = await resetRoomCodeAction("en", { status: "idle" }, form("b", ""));

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.room).toBe("b");
    expect(result.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
    expect(mocks.hash).toHaveBeenCalledWith(result.code, 12);
    expect(mocks.setStoredHash).toHaveBeenCalledWith("b", "bcrypt-hash");
    expect(mocks.bumpRoomSessionVersion).toHaveBeenCalledWith("b");
  });
});
