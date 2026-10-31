import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet, set: mocks.cookieSet }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { logoutAction } from "@/app/logout-actions";
import { signAdminSession, signTenantSession } from "@/lib/session";

const SECRET = "logout-action-test-secret-0123456789abcdef";
const REDIRECT = new Error("NEXT_REDIRECT");

const clearingOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 0,
};

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", SECRET);
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.cookieGet.mockReturnValue(undefined);
  mocks.redirect.mockImplementation(() => {
    throw REDIRECT;
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function withCookie(value: string) {
  mocks.cookieGet.mockReturnValue({ value });
}

describe("logoutAction", () => {
  it("clears the cookie and redirects a tenant to the tenant login", async () => {
    withCookie(await signTenantSession("a", 4));

    await expect(logoutAction()).rejects.toBe(REDIRECT);

    expect(mocks.cookieSet).toHaveBeenCalledWith("tp_session", "", clearingOptions);
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("clears the cookie and redirects an admin to the admin login", async () => {
    withCookie(await signAdminSession());

    await expect(logoutAction()).rejects.toBe(REDIRECT);

    expect(mocks.cookieSet).toHaveBeenCalledWith("tp_session", "", clearingOptions);
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/login");
  });

  it("clears any cookie and redirects to the tenant login when no session exists", async () => {
    await expect(logoutAction()).rejects.toBe(REDIRECT);

    expect(mocks.cookieSet).toHaveBeenCalledWith("tp_session", "", clearingOptions);
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("treats a tampered token as unauthenticated and still clears the cookie", async () => {
    withCookie(`${await signTenantSession("a", 4)}tampered`);

    await expect(logoutAction()).rejects.toBe(REDIRECT);

    expect(mocks.cookieSet).toHaveBeenCalledWith("tp_session", "", clearingOptions);
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("treats an expired token as unauthenticated and still clears the cookie", async () => {
    const secret = new TextEncoder().encode(SECRET);
    const expired = await new SignJWT({ role: "tenant", room: "a", v: 4 })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret);
    withCookie(expired);

    await expect(logoutAction()).rejects.toBe(REDIRECT);

    expect(mocks.cookieSet).toHaveBeenCalledWith("tp_session", "", clearingOptions);
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("clears the cookie before throwing the redirect", async () => {
    withCookie(await signTenantSession("a", 4));

    await expect(logoutAction()).rejects.toBe(REDIRECT);

    expect(mocks.cookieSet.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.redirect.mock.invocationCallOrder[0],
    );
  });

  it("takes no parameters and contains no client-input or room-state handling", () => {
    const source = readFileSync(new URL("../app/logout-actions.ts", import.meta.url), "utf8");

    expect(logoutAction.length).toBe(0);
    expect(source).not.toMatch(/formData/);
    expect(source).not.toMatch(/searchParams/);
    expect(source).not.toMatch(/next=/);
    expect(source).not.toMatch(/role=/);
    expect(source).not.toMatch(/@\/lib\/(rate-limit|code-store|session-version)/);
  });
});
