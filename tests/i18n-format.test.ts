import { describe, expect, it } from "vitest";
import { formatDate, formatTwd } from "@/lib/i18n/format";

describe("locale-aware formatting", () => {
  it("formats amounts as New Taiwan dollars for English", () => {
    expect(formatTwd(75000, "en")).toBe("NT$750.00");
  });

  it("formats amounts with zh-TW number conventions", () => {
    expect(formatTwd(75000, "zh-TW")).toBe(
      new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD" }).format(750),
    );
  });

  it("formats dates with the active locale", () => {
    expect(formatDate("2026-11-01", "en")).toBe("Nov 1, 2026");
    expect(formatDate("2026-11-01", "zh-TW")).toBe("2026年11月1日");
  });

  it("parses stored dates in UTC so they never shift a day", () => {
    expect(formatDate("2026-11-01", "en")).not.toContain("Oct 31");
    expect(formatDate("2026-11-01", "zh-TW")).not.toContain("10月31");
    expect(formatDate("2027-01-01", "en")).toBe("Jan 1, 2027");
    expect(formatDate("2027-01-01", "zh-TW")).toBe("2027年1月1日");
  });
});
