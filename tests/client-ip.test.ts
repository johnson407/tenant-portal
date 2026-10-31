import { describe, expect, it } from "vitest";
import { clientIpFromHeaders } from "@/lib/client-ip";

function headers(values: Record<string, string | null>) {
  return { get: (name: string) => values[name] ?? null };
}

describe("clientIpFromHeaders", () => {
  it("prefers the proxy-set x-real-ip header", () => {
    expect(
      clientIpFromHeaders(headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1" })),
    ).toBe("203.0.113.7");
  });

  it("uses the last x-forwarded-for entry, which the trusted proxy appends", () => {
    expect(
      clientIpFromHeaders(headers({ "x-forwarded-for": "spoofed, 198.51.100.4, 203.0.113.9" })),
    ).toBe("203.0.113.9");
  });

  it("trims whitespace and ignores empty values", () => {
    expect(clientIpFromHeaders(headers({ "x-real-ip": "  ", "x-forwarded-for": " 10.0.0.1 " }))).toBe(
      "10.0.0.1",
    );
  });

  it("falls back to a stable unknown marker", () => {
    expect(clientIpFromHeaders(headers({}))).toBe("unknown-ip");
  });
});
