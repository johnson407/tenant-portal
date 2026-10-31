import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const SECRET = "middleware-test-secret-0123456789abcdef";

function request(path: string, token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `tp_session=${token}`;
  return new NextRequest(`https://portal.test${path}`, { headers });
}

function redirectedTo(response: Response): string | null {
  const location = response.headers.get("location");
  return location ? new URL(location).pathname : null;
}

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("middleware route guards", () => {
  it("redirects an anonymous request for a room to the tenant login", async () => {
    const response = await middleware(request("/rooms/a"));
    expect(response.status).toBe(307);
    expect(redirectedTo(response)).toBe("/login");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("allows a valid tenant cookie into the room area", async () => {
    const { signTenantSession } = await import("@/lib/session");
    const token = await signTenantSession("a", 0);
    const response = await middleware(request("/rooms/a", token));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("redirects an admin session away from the tenant room area", async () => {
    const { signAdminSession } = await import("@/lib/session");
    const token = await signAdminSession();
    const response = await middleware(request("/rooms/a", token));
    expect(redirectedTo(response)).toBe("/login");
  });

  it("redirects a tenant session away from the admin area", async () => {
    const { signTenantSession } = await import("@/lib/session");
    const token = await signTenantSession("a", 0);
    const response = await middleware(request("/admin", token));
    expect(redirectedTo(response)).toBe("/admin/login");
  });

  it("allows admin login and a valid admin session in the admin area", async () => {
    const anon = await middleware(request("/admin/login"));
    expect(anon.headers.get("x-middleware-next")).toBe("1");

    const { signAdminSession } = await import("@/lib/session");
    const token = await signAdminSession();
    const admin = await middleware(request("/admin", token));
    expect(admin.headers.get("x-middleware-next")).toBe("1");
    expect(admin.headers.get("cache-control")).toBe("no-store");
  });

  it("redirects protected pages when the session is absent or tampered after logout", async () => {
    const noCookieRoom = await middleware(request("/rooms/a"));
    expect(redirectedTo(noCookieRoom)).toBe("/login");
    expect(noCookieRoom.headers.get("cache-control")).toBe("no-store");

    const tamperedRoom = await middleware(request("/rooms/a", "tampered-token"));
    expect(redirectedTo(tamperedRoom)).toBe("/login");
    expect(tamperedRoom.headers.get("cache-control")).toBe("no-store");

    const tamperedAdmin = await middleware(request("/admin", "tampered-token"));
    expect(redirectedTo(tamperedAdmin)).toBe("/admin/login");
    expect(tamperedAdmin.headers.get("cache-control")).toBe("no-store");
  });
});
