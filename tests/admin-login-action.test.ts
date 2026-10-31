import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeAttempt: vi.fn(),
  clearRateLimit: vi.fn(),
  adminPasswordMatches: vi.fn(),
  clientIpKeys: vi.fn(),
  establishAdminSession: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  ADMIN_LOGIN_RATE_BUCKET: { prefix: "ratelimit:admin-login", maxAttempts: 10, windowSeconds: 900 },
  consumeAttempt: mocks.consumeAttempt,
  clearRateLimit: mocks.clearRateLimit,
}));

vi.mock("@/lib/admin-auth", () => ({
  adminPasswordMatches: mocks.adminPasswordMatches,
  clientIpKeys: mocks.clientIpKeys,
  establishAdminSession: mocks.establishAdminSession,
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { adminLoginAction } from "@/app/admin/login/actions";
import { GENERIC_ADMIN_LOGIN_ERROR } from "@/app/admin/login-state";

const REDIRECT = new Error("NEXT_REDIRECT");

function form(password: string): FormData {
  const data = new FormData();
  data.set("password", password);
  return data;
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.clientIpKeys.mockResolvedValue(["ip:203.0.113.9"]);
  mocks.consumeAttempt.mockResolvedValue({ allowed: true, retryAfterSeconds: null });
  mocks.adminPasswordMatches.mockReturnValue(true);
  mocks.establishAdminSession.mockResolvedValue(undefined);
  mocks.redirect.mockImplementation(() => {
    throw REDIRECT;
  });
});

describe("adminLoginAction rate limiting", () => {
  it("consumes the IP-limited bucket before checking the password", async () => {
    await expect(adminLoginAction({}, form("secret"))).rejects.toBe(REDIRECT);

    expect(mocks.consumeAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "ratelimit:admin-login" }),
      ["ip:203.0.113.9"],
    );
    expect(mocks.consumeAttempt.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.adminPasswordMatches.mock.invocationCallOrder[0],
    );
  });

  it("fails closed and does not check the password when the limiter is unavailable", async () => {
    mocks.consumeAttempt.mockRejectedValue(new Error("KV store is not configured"));

    await expect(adminLoginAction({}, form("secret"))).resolves.toEqual({
      error: GENERIC_ADMIN_LOGIN_ERROR,
    });
    expect(mocks.adminPasswordMatches).not.toHaveBeenCalled();
    expect(mocks.establishAdminSession).not.toHaveBeenCalled();
  });

  it("does not check the password when the bucket is exhausted", async () => {
    mocks.consumeAttempt.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });

    await expect(adminLoginAction({}, form("secret"))).resolves.toEqual({
      error: GENERIC_ADMIN_LOGIN_ERROR,
    });
    expect(mocks.adminPasswordMatches).not.toHaveBeenCalled();
  });

  it("clears the limiter and establishes a session after a correct password", async () => {
    await expect(adminLoginAction({}, form("secret"))).rejects.toBe(REDIRECT);

    expect(mocks.clearRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "ratelimit:admin-login" }),
      ["ip:203.0.113.9"],
    );
    expect(mocks.establishAdminSession).toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/admin");
  });
});
