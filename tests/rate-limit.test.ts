import { describe, expect, it } from "vitest";

describe("rate limit lib", () => {
  it("encodes exponential backoff after maxAttempts", async () => {
    const { backoffSecondsFor, LOGIN_RATE_BUCKET } = await import("@/lib/rate-limit");
    expect(backoffSecondsFor(10, LOGIN_RATE_BUCKET)).toBe(0);
    expect(backoffSecondsFor(11, LOGIN_RATE_BUCKET)).toBe(60);
    expect(backoffSecondsFor(12, LOGIN_RATE_BUCKET)).toBe(120);
    expect(backoffSecondsFor(99, LOGIN_RATE_BUCKET)).toBe(30 * 60);
  });
});
