import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function walk(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory()
      ? walk(path)
      : /\.(?:ts|tsx|mjs|js)$/.test(path)
        ? [path]
        : [];
  });
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const APP_SOURCES = walk(join(repoRoot, "app"));
const LIB_SOURCES = walk(join(repoRoot, "lib"));
const TEST_SOURCES = walk(join(repoRoot, "tests"));
const SOURCE_FILES = [...APP_SOURCES, ...LIB_SOURCES];

// Build the private main-file name from fragments so this test file does not
// itself contain the name it forbids in application code.
const MAIN_RENT_FILE = ["房", "租", "2022", "-", "2032"].join("");

function warningsIn(source: string): string[] {
  return source.match(/console\.(?:warn|error)\([\s\S]*?\);/g) ?? [];
}

describe("repair server-only boundary", () => {
  it("keeps repair data out of client components", () => {
    const clientFiles = SOURCE_FILES.filter((file) => {
      const source = read(file);
      return source.includes('"use client"') || source.includes("'use client'");
    });
    const offenders = clientFiles.filter((file) => {
      const source = read(file);
      return (
        source.includes("@/lib/appfeed/repairs") ||
        source.includes("@/lib/appfeed/google") ||
        source.includes("@/lib/appfeed/validate")
      );
    });

    expect(offenders).toEqual([]);
  });

  it("marks the repair accessor and Google client as server-only", () => {
    expect(read(join(repoRoot, "lib/appfeed/repairs.ts"))).toContain(
      'import "server-only"',
    );
    expect(read(join(repoRoot, "lib/appfeed/google.ts"))).toContain(
      'import "server-only"',
    );
  });

  it("does not return a full Repairs snapshot from a route or action", () => {
    const offenders = APP_SOURCES.filter((file) => {
      const name = file.split("/").pop() ?? "";
      if (name !== "route.ts" && !name.endsWith("actions.ts")) return false;
      const source = read(file);
      return (
        source.includes("fetchRepairsSnapshot") ||
        source.includes("RepairsSnapshot") ||
        source.includes("buildPendingRepairs")
      );
    });

    expect(offenders).toEqual([]);
  });
});

describe("repair note confidentiality", () => {
  it("keeps note and request ID values out of warnings", () => {
    const sources = [
      read(join(repoRoot, "lib/appfeed/repairs.ts")),
      read(join(repoRoot, "lib/appfeed/repair-lock.ts")),
      read(join(repoRoot, "lib/appfeed/google.ts")),
      read(join(repoRoot, "lib/appfeed/validate.ts")),
      read(join(repoRoot, "app/[lang]/rooms/[room]/repair-actions.ts")),
      read(join(repoRoot, "app/[lang]/admin/repair-actions.ts")),
    ];
    const warnings = sources.flatMap(warningsIn);

    expect(warnings.length).toBeGreaterThan(0);
    for (const warning of warnings) {
      expect(warning).not.toMatch(/\bnote\s*[:,}]/);
      expect(warning).not.toMatch(/\brequestId\s*[:,}]/);
      expect(warning).not.toMatch(/\bparsed\.note\b/);
      expect(warning).not.toMatch(/\broom\s*[:,}]/);
    }
  });

  it("keeps repair values out of page metadata", () => {
    const roomPage = read(
      join(repoRoot, "app/[lang]/rooms/[room]/page.tsx"),
    );
    const roomMetadata = roomPage.slice(
      roomPage.indexOf("export async function generateMetadata"),
      roomPage.indexOf("export default async function RoomPage"),
    );
    expect(roomMetadata).not.toContain("repair.note");
    expect(roomMetadata).not.toContain("requestId");

    const adminPage = read(join(repoRoot, "app/[lang]/admin/page.tsx"));
    const adminMetadata = adminPage.slice(
      adminPage.indexOf("export async function generateMetadata"),
      adminPage.indexOf("export default async function AdminPage"),
    );
    expect(adminMetadata).not.toContain("repair.note");
    expect(adminMetadata).not.toContain("requestId");
  });

  it("uses only synthetic personal data in repair fixtures", () => {
    const allowed = new Set([
      "jane@example.com",
      "appfeed-reader@example.iam.gserviceaccount.com",
    ]);
    const files = TEST_SOURCES.filter(
      (file) =>
        /appfeed-repairs-.*\.test\.ts$/.test(file) ||
        /\/(?:repair-actions|repair-forms)\.test\.ts$/.test(file),
    );
    const matches = files.flatMap((file) => {
      const source = read(file);
      return [
        ...source.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
        ...source.matchAll(/\b09\d{8}\b/g),
        ...source.matchAll(/\b[A-Z][12]\d{8}\b/g),
      ].map((match) => match[0]);
    });

    for (const match of matches) {
      expect(allowed.has(match), `unexpected PII-like fixture: ${match}`).toBe(
        true,
      );
    }
  });
});

describe("no main rent file references in repair code", () => {
  it("contains no Sheets /d/ URL or main rent file name", () => {
    const leaks = SOURCE_FILES.filter((file) => {
      const source = read(file);
      return (
        source.includes("spreadsheets/d/") ||
        source.includes(MAIN_RENT_FILE)
      );
    });

    expect(leaks).toEqual([]);
  });
});
