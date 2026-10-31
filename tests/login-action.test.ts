import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyRoomCode: vi.fn(),
  signTenantSession: vi.fn(),
  getRoomSessionVersion: vi.fn(),
  consumeAttempt: vi.fn(),
  clearRateLimit: vi.fn(),
  cookieSet: vi.fn(),
  headersGet: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: mocks.headersGet }),
  cookies: async () => ({ set: mocks.cookieSet, get: vi.fn() }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("@/lib/verify-room-code", () => ({ verifyRoomCode: mocks.verifyRoomCode }));

vi.mock("@/lib/session", () => ({
  SESSION_COOKIE_NAME: "tp_session",
  TENANT_SESSION_MAX_AGE_SECONDS: 604800,
  signTenantSession: mocks.signTenantSession,
}));

vi.mock("@/lib/session-version", () => ({
  getRoomSessionVersion: mocks.getRoomSessionVersion,
}));

vi.mock("@/lib/rate-limit", () => ({
  LOGIN_RATE_BUCKET: { prefix: "ratelimit:login", maxAttempts: 10, windowSeconds: 900 },
  consumeAttempt: mocks.consumeAttempt,
  clearRateLimit: mocks.clearRateLimit,
}));

import { loginAction } from "@/app/[lang]/login/actions";
import { GENERIC_LOGIN_ERROR } from "@/app/[lang]/login/login-state";

const REDIRECT = new Error("NEXT_REDIRECT");

function form(room: string, code: string): FormData {
  const data = new FormData();
  data.set("room", room);
  data.set("code", code);
  return data;
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.headersGet.mockReturnValue("203.0.113.9");
  mocks.consumeAttempt.mockResolvedValue({ allowed: true, retryAfterSeconds: null });
  mocks.verifyRoomCode.mockResolvedValue({ ok: true, room: "a" });
  mocks.getRoomSessionVersion.mockResolvedValue(4);
  mocks.signTenantSession.mockResolvedValue("signed-token");
  mocks.redirect.mockImplementation(() => {
    throw REDIRECT;
  });
});

describe("loginAction rate limiting and session versioning", () => {
  it("limits by both client IP and room before checking the code", async () => {
    await expect(loginAction("zh-TW", {}, form("a", "0123456789"))).rejects.toBe(REDIRECT);

    expect(mocks.consumeAttempt).toHaveBeenCalledWith(expect.anything(), [
      "ip:203.0.113.9",
      "room:a",
    ]);
    expect(mocks.consumeAttempt.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.verifyRoomCode.mock.invocationCallOrder[0],
    );
  });

  it("sets a tenant cookie carrying the current session version", async () => {
    await expect(loginAction("zh-TW", {}, form("a", "0123456789"))).rejects.toBe(REDIRECT);

    expect(mocks.getRoomSessionVersion).toHaveBeenCalledWith("a");
    expect(mocks.signTenantSession).toHaveBeenCalledWith("a", 4);
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      expect.objectContaining({ name: "tp_session", value: "signed-token", httpOnly: true }),
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/zh-TW/rooms/a");
  });

  it("keeps the English locale on a successful sign-in", async () => {
    await expect(loginAction("en", {}, form("a", "0123456789"))).rejects.toBe(REDIRECT);

    expect(mocks.redirect).toHaveBeenCalledWith("/en/rooms/a");
  });

  it("falls back to zh-TW when the bound locale is tampered with", async () => {
    await expect(
      loginAction("https://evil.example", {}, form("a", "0123456789")),
    ).rejects.toBe(REDIRECT);

    expect(mocks.redirect).toHaveBeenCalledWith("/zh-TW/rooms/a");
  });

  it("returns a locale-independent error code", async () => {
    mocks.verifyRoomCode.mockResolvedValue({ ok: false, reason: "incorrect_code" });

    await expect(loginAction("en", {}, form("a", "9999999999"))).resolves.toEqual({
      error: "invalid-credentials",
    });
  });

  it("does not check the code when the rate limit is exhausted", async () => {
    mocks.consumeAttempt.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });

    await expect(loginAction("zh-TW", {}, form("a", "0123456789"))).resolves.toEqual({
      error: GENERIC_LOGIN_ERROR,
    });
    expect(mocks.verifyRoomCode).not.toHaveBeenCalled();
  });

  it("fails closed with a generic error when the rate limiter is unavailable", async () => {
    mocks.consumeAttempt.mockRejectedValue(new Error("KV store is not configured"));

    await expect(loginAction("zh-TW", {}, form("a", "0123456789"))).resolves.toEqual({
      error: GENERIC_LOGIN_ERROR,
    });
    expect(mocks.verifyRoomCode).not.toHaveBeenCalled();
  });

  it("does not clear the limiter or issue a cookie after a wrong code", async () => {
    mocks.verifyRoomCode.mockResolvedValue({ ok: false, reason: "incorrect_code" });

    await expect(loginAction("zh-TW", {}, form("a", "9999999999"))).resolves.toEqual({
      error: GENERIC_LOGIN_ERROR,
    });
    expect(mocks.clearRateLimit).not.toHaveBeenCalled();
    expect(mocks.signTenantSession).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
});
