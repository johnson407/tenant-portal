import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { config, middleware } from "@/middleware";

const SECRET = "middleware-test-secret-0123456789abcdef";

function request(path: string, token?: string, headers: Record<string, string> = {}): NextRequest {
  const requestHeaders: Record<string, string> = { ...headers };
  if (token) requestHeaders.cookie = `tp_session=${token}`;
  return new NextRequest(`https://portal.test${path}`, { headers: requestHeaders });
}

function redirectLocation(response: Response): URL | null {
  const location = response.headers.get("location");
  return location ? new URL(location) : null;
}

function redirectedTo(response: Response): string | null {
  return redirectLocation(response)?.pathname ?? null;
}

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("middleware locale normalization", () => {
  it("redirects a bare path to the default locale", async () => {
    const response = await middleware(request("/login"));
    expect(response.status).toBe(307);
    expect(redirectedTo(response)).toBe("/zh-TW/login");
  });

  it("preserves the path and query string when adding the default locale", async () => {
    const response = await middleware(request("/rooms/a?from=email"));
    expect(redirectedTo(response)).toBe("/zh-TW/rooms/a");
    expect(redirectLocation(response)?.search).toBe("?from=email");
  });

  it("redirects the root path to the default locale", async () => {
    const response = await middleware(request("/"));
    expect(redirectedTo(response)).toBe("/zh-TW");
  });

  it("ignores Accept-Language and still defaults to zh-TW", async () => {
    const response = await middleware(
      request("/", undefined, { "accept-language": "en-US,en;q=0.9" }),
    );
    expect(redirectedTo(response)).toBe("/zh-TW");
  });

  it("keeps explicit English routes intact", async () => {
    const response = await middleware(request("/en/login"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("treats an unsupported locale-like segment as a bare path", async () => {
    const response = await middleware(request("/fr/login"));
    expect(redirectedTo(response)).toBe("/zh-TW/fr/login");
  });

  it("does not match static asset requests", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test("/en/login")).toBe(true);
    expect(matcher.test("/rooms/a")).toBe(true);
    expect(matcher.test("/_next/static/chunk.js")).toBe(false);
    expect(matcher.test("/favicon.ico")).toBe(false);
    expect(matcher.test("/images/logo.png")).toBe(false);
  });
});

describe("middleware route guards", () => {
  it("redirects an anonymous request for a room to the localized tenant login", async () => {
    const response = await middleware(request("/zh-TW/rooms/a"));
    expect(response.status).toBe(307);
    expect(redirectedTo(response)).toBe("/zh-TW/login");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("redirects an anonymous admin request to the localized admin login", async () => {
    const response = await middleware(request("/zh-TW/admin"));
    expect(redirectedTo(response)).toBe("/zh-TW/admin/login");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("allows a valid tenant cookie into the room area in either locale", async () => {
    const { signTenantSession } = await import("@/lib/session");
    const token = await signTenantSession("a", 0);

    const zh = await middleware(request("/zh-TW/rooms/a", token));
    expect(zh.headers.get("x-middleware-next")).toBe("1");
    expect(zh.headers.get("cache-control")).toBe("no-store");

    const en = await middleware(request("/en/rooms/a", token));
    expect(en.headers.get("x-middleware-next")).toBe("1");
    expect(en.headers.get("cache-control")).toBe("no-store");
  });

  it("redirects an admin session away from the tenant room area", async () => {
    const { signAdminSession } = await import("@/lib/session");
    const token = await signAdminSession();
    const response = await middleware(request("/en/rooms/a", token));
    expect(redirectedTo(response)).toBe("/en/login");
  });

  it("redirects a tenant session away from the admin area", async () => {
    const { signTenantSession } = await import("@/lib/session");
    const token = await signTenantSession("a", 0);
    const response = await middleware(request("/zh-TW/admin", token));
    expect(redirectedTo(response)).toBe("/zh-TW/admin/login");
  });

  it("allows admin login and a valid admin session in both locales", async () => {
    const zhLogin = await middleware(request("/zh-TW/admin/login"));
    expect(zhLogin.headers.get("x-middleware-next")).toBe("1");

    const enLogin = await middleware(request("/en/admin/login"));
    expect(enLogin.headers.get("x-middleware-next")).toBe("1");

    const { signAdminSession } = await import("@/lib/session");
    const token = await signAdminSession();
    const zhAdmin = await middleware(request("/zh-TW/admin", token));
    expect(zhAdmin.headers.get("x-middleware-next")).toBe("1");
    expect(zhAdmin.headers.get("cache-control")).toBe("no-store");

    const enAdmin = await middleware(request("/en/admin", token));
    expect(enAdmin.headers.get("x-middleware-next")).toBe("1");
    expect(enAdmin.headers.get("cache-control")).toBe("no-store");
  });

  it("redirects protected pages when the session is absent or tampered after logout", async () => {
    const noCookieRoom = await middleware(request("/en/rooms/a"));
    expect(redirectedTo(noCookieRoom)).toBe("/en/login");
    expect(noCookieRoom.headers.get("cache-control")).toBe("no-store");

    const tamperedRoom = await middleware(request("/zh-TW/rooms/a", "tampered-token"));
    expect(redirectedTo(tamperedRoom)).toBe("/zh-TW/login");
    expect(tamperedRoom.headers.get("cache-control")).toBe("no-store");

    const tamperedAdmin = await middleware(request("/en/admin", "tampered-token"));
    expect(redirectedTo(tamperedAdmin)).toBe("/en/admin/login");
    expect(tamperedAdmin.headers.get("cache-control")).toBe("no-store");
  });
});
