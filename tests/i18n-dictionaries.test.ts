import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { LOCALES } from "@/lib/i18n/config";
import en from "@/lib/i18n/dictionaries/en";
import zhTW from "@/lib/i18n/dictionaries/zh-TW";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function stringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value !== "object" || value === null) return [];
  return Object.values(value).flatMap(stringValues);
}

describe("dictionaries", () => {
  it("exposes the same key structure for both locales", () => {
    expect(keyPaths(zhTW)).toEqual(keyPaths(en));
    expect(keyPaths(zhTW).length).toBeGreaterThan(40);
  });

  it("returns the dictionary for every supported locale", () => {
    for (const locale of LOCALES) {
      expect(getDictionary(locale)).toBe(locale === "zh-TW" ? zhTW : en);
    }
  });

  it("has Traditional Chinese copy in zh-TW and English copy in en", () => {
    expect(zhTW.login.heading).toMatch(/[\u3400-\u9fff]/);
    expect(zhTW.room.bills).toMatch(/[\u3400-\u9fff]/);
    expect(zhTW.admin.warning).toMatch(/[\u3400-\u9fff]/);

    const englishStrings = stringValues(en).filter((value) => value !== en.common.switchLocale);
    expect(englishStrings.some((value) => /[\u3400-\u9fff]/.test(value))).toBe(false);
  });

  it("gives the bill breakdown template all four placeholders", () => {
    for (const template of [
      en.room.billBreakdownTemplate,
      zhTW.room.billBreakdownTemplate,
    ]) {
      for (const placeholder of ["{start}", "{end}", "{units}", "{rate}"]) {
        expect(template).toContain(placeholder);
      }
    }

    expect(zhTW.room.billBreakdownTemplate).toMatch(/[\u3400-\u9fff]/);
    expect(en.room.billBreakdownTemplate).not.toMatch(/[\u3400-\u9fff]/);
  });

  it("keeps the language switcher pointed at the other locale", () => {
    expect(zhTW.common.switchLocale).toBe("English");
    expect(en.common.switchLocale).toBe("繁體中文");
  });
});
