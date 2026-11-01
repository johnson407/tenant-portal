import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/dictionaries/en";
import zhTW from "@/lib/i18n/dictionaries/zh-TW";
import { REPAIR_CATEGORIES } from "@/lib/appfeed/validate";

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

function repairCopy(dictionary: typeof en) {
  return {
    room: dictionary.room.repairs,
    admin: dictionary.admin.repairs,
  };
}

describe("repair dictionary copy", () => {
  it("has the same repair key structure in both locales", () => {
    expect(keyPaths(repairCopy(zhTW))).toEqual(keyPaths(repairCopy(en)));
  });

  it("has no empty repair string in either locale", () => {
    for (const dictionary of [en, zhTW]) {
      const values = stringValues(repairCopy(dictionary));
      expect(values.length).toBeGreaterThan(30);
      for (const value of values) {
        expect(value.trim()).not.toBe("");
      }
    }
  });

  it("covers every stored category and both statuses", () => {
    for (const dictionary of [en, zhTW]) {
      expect(
        Object.keys(dictionary.room.repairs.categories).sort(),
      ).toEqual([...REPAIR_CATEGORIES].sort());
      expect(
        Object.keys(dictionary.room.repairs.history.status).sort(),
      ).toEqual(["done", "pending"]);
      expect(dictionary.admin.repairs.pending).toBe(
        dictionary.room.repairs.history.status.pending,
      );
      expect(dictionary.admin.repairs.done).toBe(
        dictionary.room.repairs.history.status.done,
      );
    }
  });

  it("uses the active locale for every repair string", () => {
    for (const value of stringValues(repairCopy(en))) {
      expect(value).not.toMatch(/[\u3400-\u9fff]/);
    }
    for (const value of stringValues(repairCopy(zhTW))) {
      expect(value).toMatch(/[\u3400-\u9fff]/);
    }
  });
});
