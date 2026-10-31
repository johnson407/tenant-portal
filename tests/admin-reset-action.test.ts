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

import { resetRoomCodeAction } from "@/app/admin/actions";
import { GENERIC_ADMIN_RESET_ERROR } from "@/app/admin/login-state";

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
  it("rejects a tenant session without changing the stored hash or session version", async () => {
    mocks.getSessionClaims.mockResolvedValue({ role: "tenant", room: "a", v: 0, exp: 1 });

    const result = await resetRoomCodeAction({ status: "idle" }, form("b", "ABCDEFGHIJ"));

    expect(result).toEqual({ status: "error", message: GENERIC_ADMIN_RESET_ERROR });
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.setStoredHash).not.toHaveBeenCalled();
    expect(mocks.bumpRoomSessionVersion).not.toHaveBeenCalled();
  });

  it("rejects an anonymous caller without changing the stored hash or session version", async () => {
    mocks.getSessionClaims.mockResolvedValue(null);

    const result = await resetRoomCodeAction({ status: "idle" }, form("b", "ABCDEFGHIJ"));

    expect(result).toEqual({ status: "error", message: GENERIC_ADMIN_RESET_ERROR });
    expect(mocks.setStoredHash).not.toHaveBeenCalled();
    expect(mocks.bumpRoomSessionVersion).not.toHaveBeenCalled();
  });

  it("resets the code and revokes existing tenant sessions for that room", async () => {
    const result = await resetRoomCodeAction({ status: "idle" }, form("b", "ABCDEFGHIJ"));

    expect(result).toEqual({ status: "success", room: "b", code: "ABCDEFGHIJ" });
    expect(mocks.setStoredHash).toHaveBeenCalledWith("b", "bcrypt-hash");
    expect(mocks.bumpRoomSessionVersion).toHaveBeenCalledWith("b");
  });

  it("returns a generic error and no plaintext if the KV write fails", async () => {
    mocks.setStoredHash.mockRejectedValue(new Error("kv down"));

    const result = await resetRoomCodeAction({ status: "idle" }, form("b", "ABCDEFGHIJ"));

    expect(result).toEqual({ status: "error", message: GENERIC_ADMIN_RESET_ERROR });
  });
});
