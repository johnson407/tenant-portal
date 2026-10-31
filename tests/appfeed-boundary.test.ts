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
const SOURCE_FILES = [...APP_SOURCES, ...LIB_SOURCES];
const ENV_EXAMPLE = join(repoRoot, ".env.example");

// Build the private main-file name from fragments so this test file does not
// itself contain the name it forbids in application code.
const MAIN_RENT_FILE = ["房", "租", "2022", "-", "2032"].join("");

describe("AppFeed server-only boundary", () => {
  it("does not let a client component import the feed, Google client, or validators", () => {
    const clientFiles = SOURCE_FILES.filter((file) => {
      const source = read(file);
      return source.includes('"use client"') || source.includes("'use client'");
    });

    expect(clientFiles.length).toBeGreaterThan(0);
    const offenders = clientFiles.filter((file) => {
      const source = read(file);
      return (
        source.includes("@/lib/appfeed/feed") ||
        source.includes("@/lib/appfeed/google") ||
        source.includes("@/lib/appfeed/validate")
      );
    });

    expect(offenders).toEqual([]);
  });

  it("keeps all Google and AppFeed env vars out of NEXT_PUBLIC_", () => {
    const offenders = [...SOURCE_FILES, ENV_EXAMPLE].filter((file) =>
      /NEXT_PUBLIC_[A-Z0-9_]*(?:GOOGLE|APPFEED)[A-Z0-9_]*/.test(read(file)),
    );

    expect(offenders).toEqual([]);
  });

  it("removes the placeholder data module and every import of it", () => {
    const placeholderModule = ["placeholder", "-data"].join("");
    expect(existsSync(join(repoRoot, "lib", `${placeholderModule}.ts`))).toBe(
      false,
    );

    const offenders = [...SOURCE_FILES, ...walk(join(repoRoot, "tests"))].filter(
      (file) => read(file).includes(placeholderModule),
    );
    expect(offenders).toEqual([]);
  });

  it("marks the Google client and cached accessor as server-only", () => {
    expect(read(join(repoRoot, "lib/appfeed/google.ts"))).toContain(
      'import "server-only"',
    );
    expect(read(join(repoRoot, "lib/appfeed/feed.ts"))).toContain(
      'import "server-only"',
    );
  });

  it("does not expose feed data through a route handler or Server Action", () => {
    const offenders = APP_SOURCES.filter((file) => {
      const name = file.split("/").pop() ?? "";
      if (name !== "route.ts" && !name.endsWith("actions.ts")) return false;
      return read(file).includes("lib/appfeed/feed");
    });

    expect(offenders).toEqual([]);
  });
});

describe("no main rent file references", () => {
  it("does not leave stale placeholder amounts in scripts or e2e checks", () => {
    const files = [
      ...walk(join(repoRoot, "scripts")),
      ...walk(join(repoRoot, "e2e")),
    ];
    const leaks = files.filter((file) =>
      /\$750\.00|\$700\.00|PLACEHOLDER_ROOM_DATA/.test(read(file)),
    );

    expect(leaks).toEqual([]);
  });

  it("contains no Google Sheets /d/ URL or main rent file name in app, lib, or env example", () => {
    const files = [...SOURCE_FILES, ENV_EXAMPLE];
    const leaks = files.filter((file) => {
      const source = read(file);
      return source.includes("spreadsheets/d/") || source.includes(MAIN_RENT_FILE);
    });

    expect(leaks).toEqual([]);
  });
});

describe("synthetic AppFeed fixtures", () => {
  const ALLOWED_PII = new Set([
    "jane@example.com",
    "appfeed-reader@example.iam.gserviceaccount.com",
    "0912345678",
    "A123456789",
  ]);

  it("uses only invented emails, phone numbers, and ID numbers in AppFeed tests", () => {
    const files = walk(join(repoRoot, "tests")).filter((file) =>
      /appfeed-.*\.test\.ts$/.test(file),
    );
    const matches = files.flatMap((file) => {
      const source = read(file);
      return [
        ...source.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
        ...source.matchAll(/\b09\d{8}\b/g),
        ...source.matchAll(/\b[A-Z][12]\d{8}\b/g),
      ].map((match) => match[0]);
    });

    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      expect(ALLOWED_PII.has(match), `unexpected PII-like fixture: ${match}`).toBe(
        true,
      );
    }
  });
});
