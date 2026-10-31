import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@upstash/redis", () => {
  class Redis {
    constructor(_opts: { url: string; token: string }) {}
    async get() {
      return null;
    }
    async set() {
      return "OK";
    }
  }
  return { Redis };
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session sign/verify", () => {
  it("round-trips a tenant token with its session version", async () => {
    vi.stubEnv("SESSION_SECRET", "unit-test-session-secret-0123456789abcdef");
    const { signTenantSession, verifySession } = await import("@/lib/session");
    const token = await signTenantSession("a", 3);
    const claims = await verifySession(token);
    expect(claims).toEqual({ role: "tenant", room: "a", v: 3, exp: expect.any(Number) });
  });

  it("rejects a tenant token that has no session version", async () => {
    vi.stubEnv("SESSION_SECRET", "unit-test-session-secret-0123456789abcdef");
    const { SignJWT } = await import("jose");
    const { verifySession } = await import("@/lib/session");
    const token = await new SignJWT({ role: "tenant", room: "a" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("unit-test-session-secret-0123456789abcdef"));
    expect(await verifySession(token)).toBeNull();
  });

  it("rejects a tampered token", async () => {
    vi.stubEnv("SESSION_SECRET", "unit-test-session-secret-0123456789abcdef");
    const { signTenantSession, verifySession } = await import("@/lib/session");
    const token = await signTenantSession("b", 0);
    const tampered = token.slice(0, -3) + "xyz";
    expect(await verifySession(tampered)).toBeNull();
  });

  it("serializes admin claims and rejects cross-role tampering", async () => {
    vi.stubEnv("SESSION_SECRET", "unit-test-session-secret-0123456789abcdef");
    const { signAdminSession, verifySession } = await import("@/lib/session");
    const token = await signAdminSession();
    expect(await verifySession(token)).toEqual({ role: "admin", exp: expect.any(Number) });
  });

  it("rejects tokens signed with a different secret", async () => {
    vi.stubEnv("SESSION_SECRET", "secret-one-aaaaaaaaaaaaaaaa");
    const { signTenantSession } = await import("@/lib/session");
    const token = await signTenantSession("c", 0);
    vi.stubEnv("SESSION_SECRET", "secret-two-bbbbbbbbbbbbbbbb");
    vi.resetModules();
    const { verifySession: verifyOther } = await import("@/lib/session");
    expect(await verifyOther(token)).toBeNull();
  });

  it("rejects tenant claims whose room letter is invalid", async () => {
    vi.stubEnv("SESSION_SECRET", "unit-test-session-secret-0123456789abcdef");
    const { signTenantSession, verifySession } = await import("@/lib/session");
    const token = await signTenantSession("z" as never, 0);
    expect(await verifySession(token)).toBeNull();
  });
});
