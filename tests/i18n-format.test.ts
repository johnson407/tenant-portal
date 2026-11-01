import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatRate,
  formatTwd,
} from "@/lib/i18n/format";

describe("locale-aware formatting", () => {
  it("formats whole amounts as New Taiwan dollars for English", () => {
    expect(formatTwd(750, "en")).toBe("NT$750");
    expect(formatTwd(0, "en")).toBe("NT$0");
  });

  it("formats whole amounts with zh-TW number conventions", () => {
    expect(formatTwd(750, "zh-TW")).toBe("$750");
    expect(formatTwd(0, "zh-TW")).toBe("$0");
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

  it("formats meter counts as grouped whole numbers", () => {
    expect(formatCount(5100, "en")).toBe("5,100");
    expect(formatCount(5100, "zh-TW")).toBe("5,100");
    expect(formatCount(0, "en")).toBe("0");
  });

  it("formats a unit rate with up to four fraction digits", () => {
    expect(formatRate(8.5, "en")).toBe("NT$8.5");
    expect(formatRate(8.5, "zh-TW")).toBe("$8.5");
    expect(formatRate(10, "en")).toBe("NT$10");
    expect(formatRate(2.6253, "en")).toBe("NT$2.6253");
  });

  it("formats timestamps in Taiwan time for the last-updated caption", () => {
    const timestamp = "2026-11-01T04:00:00.000Z";
    expect(formatDateTime(timestamp, "en")).toBe("Nov 1, 2026, 12:00 PM");
    expect(formatDateTime(timestamp, "zh-TW")).toBe("2026年11月1日 中午12:00");
  });
});
