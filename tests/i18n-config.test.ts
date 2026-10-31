import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, isLocale, localePath } from "@/lib/i18n/config";

describe("locale config", () => {
  it("supports Traditional Chinese and English with zh-TW as the default", () => {
    expect(LOCALES).toEqual(["zh-TW", "en"]);
    expect(DEFAULT_LOCALE).toBe("zh-TW");
  });

  it("recognizes only the supported locales", () => {
    expect(isLocale("zh-TW")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("zh-CN")).toBe(false);
    expect(isLocale("EN")).toBe(false);
    expect(isLocale("")).toBe(false);
  });

  it("builds a locale-prefixed path from root-relative and bare paths", () => {
    expect(localePath("en", "/login")).toBe("/en/login");
    expect(localePath("zh-TW", "login")).toBe("/zh-TW/login");
    expect(localePath("en", "/rooms/a")).toBe("/en/rooms/a");
  });

  it("handles the root and empty paths without a trailing slash", () => {
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("zh-TW", "")).toBe("/zh-TW");
  });
});
