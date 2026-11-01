import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { AppFeedSnapshot } from "@/lib/appfeed/types";
import {
  BILLS_HEADER,
  LEASES_HEADER,
  REPAIRS_HEADER,
  buildPendingClaims,
  buildRoomFeed,
  buildRoomRepairs,
} from "@/lib/appfeed/validate";

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
        source.includes("@/lib/appfeed/validate") ||
        source.includes("@/lib/appfeed/renewal")
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

  it("marks the Google client, cached accessor, and reminder accessor as server-only", () => {
    expect(read(join(repoRoot, "lib/appfeed/google.ts"))).toContain(
      'import "server-only"',
    );
    expect(read(join(repoRoot, "lib/appfeed/feed.ts"))).toContain(
      'import "server-only"',
    );

    const renewal = read(join(repoRoot, "lib/appfeed/renewal.ts"));
    expect(renewal).toContain('import "server-only"');
    expect(renewal).toContain("fetchAppFeedSnapshot");
    expect(renewal).not.toMatch(/\bwrite[A-Z]/);
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

describe("payment claim boundaries", () => {
  const CLAIM_SENTINEL = "98765";
  const CLAIMED_ON = "2026-10-30";

  function claimSnapshot(bankLast5 = CLAIM_SENTINEL): AppFeedSnapshot {
    return {
      bills: [
        [...BILLS_HEADER],
        [
          "a",
          "2026-11",
          10000,
          "100",
          "",
          "2026-11-05",
          "",
          CLAIMED_ON,
          bankLast5,
          "1001",
          "1011",
          "10",
          "",
          "",
          "",
        ],
        [
          "b",
          "2026-11",
          20000,
          "100",
          "",
          "2026-11-05",
          "",
          "",
          "",
          "2002",
          "2012",
          "10",
          "",
          "",
          "",
        ],
      ],
      leases: [
        [...LEASES_HEADER],
        ["a", "2026-01-01", "2026-12-31", ""],
        ["b", "2026-01-01", "2026-12-31", ""],
      ],
    };
  }

  it("keeps a room A claim out of room B's feed result", () => {
    const snapshot = claimSnapshot();

    const a = buildRoomFeed(snapshot, "a", "2026-11-01T00:00:00.000Z");
    const b = buildRoomFeed(snapshot, "b", "2026-11-01T00:00:00.000Z");

    expect(a.kind).toBe("ok");
    expect(b.kind).toBe("ok");
    if (a.kind !== "ok" || b.kind !== "ok") return;

    expect(JSON.stringify(a)).toContain(CLAIM_SENTINEL);
    expect(JSON.stringify(a)).toContain(CLAIMED_ON);
    expect(JSON.stringify(b)).not.toContain(CLAIM_SENTINEL);
    expect(JSON.stringify(b)).not.toContain(CLAIMED_ON);
    expect(b.feed.openBills[0].claim).toBeNull();
  });

  it("keeps room A meter readings out of room B's feed result", () => {
    const snapshot = claimSnapshot();

    const a = buildRoomFeed(snapshot, "a", "2026-11-01T00:00:00.000Z");
    const b = buildRoomFeed(snapshot, "b", "2026-11-01T00:00:00.000Z");

    expect(a.kind).toBe("ok");
    expect(b.kind).toBe("ok");
    if (a.kind !== "ok" || b.kind !== "ok") return;

    expect(a.feed.openBills[0].waterBreakdown).toEqual({
      start: 1001,
      end: 1011,
      units: 10,
      rate: 10,
    });
    expect(b.feed.openBills[0].waterBreakdown).toEqual({
      start: 2002,
      end: 2012,
      units: 10,
      rate: 10,
    });

    expect(JSON.stringify(a)).not.toContain("2002");
    expect(JSON.stringify(a)).not.toContain("2012");
    expect(JSON.stringify(b)).not.toContain("1001");
    expect(JSON.stringify(b)).not.toContain("1011");
  });

  it("keeps room A confirmation and completion notes out of room B", () => {
    const confirmNote = "ROOM_A_CONFIRM_NOTE";
    const doneNote = "ROOM_A_DONE_NOTE";
    const snapshot: AppFeedSnapshot = {
      bills: [
        [...BILLS_HEADER],
        [
          "a",
          "2026-10",
          10000,
          "",
          "",
          "2026-11-05",
          "2026-10-20",
          "2026-10-18",
          "12345",
          "",
          "",
          "",
          "",
          "",
          "",
          "2026-10-28",
          confirmNote,
        ],
        [
          "b",
          "2026-10",
          20000,
          "",
          "",
          "2026-11-05",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ],
      ],
      leases: [
        [...LEASES_HEADER],
        ["a", "2026-01-01", "2026-12-31", ""],
        ["b", "2026-01-01", "2026-12-31", ""],
      ],
    };
    const repairs = {
      repairs: [
        [...REPAIRS_HEADER],
        [
          "a",
          "0123456789abcdef",
          "plumbing",
          "Leaking tap",
          "2026-10-20",
          "done",
          "2026-10-30",
          doneNote,
        ],
        [
          "b",
          "fedcba9876543210",
          "electrical",
          "Dim light",
          "2026-10-21",
          "pending",
          "",
          "",
        ],
      ],
    };

    const a = buildRoomFeed(snapshot, "a", "2026-11-01T00:00:00.000Z");
    const b = buildRoomFeed(snapshot, "b", "2026-11-01T00:00:00.000Z");
    const aRepairs = buildRoomRepairs(repairs, "a");
    const bRepairs = buildRoomRepairs(repairs, "b");

    expect(a.kind).toBe("ok");
    expect(b.kind).toBe("ok");
    expect(aRepairs.kind).toBe("ok");
    expect(bRepairs.kind).toBe("ok");
    if (
      a.kind !== "ok" ||
      b.kind !== "ok" ||
      aRepairs.kind !== "ok" ||
      bRepairs.kind !== "ok"
    ) {
      return;
    }

    expect(a.feed.lastConfirmation).toEqual({
      date: "2026-10-28",
      note: confirmNote,
    });
    expect(b.feed.lastConfirmation).toBeNull();
    expect(aRepairs.lastDone).toEqual({
      date: "2026-10-30",
      note: doneNote,
    });
    expect(bRepairs.lastDone).toBeNull();
    expect(JSON.stringify(b)).not.toContain(confirmNote);
    expect(JSON.stringify(bRepairs)).not.toContain(doneNote);
  });

  it("projects a pending claim to the admin list only", () => {
    const claims = buildPendingClaims(claimSnapshot());

    expect(claims).toEqual([
      {
        room: "a",
        period: "2026-11",
        claimedOn: CLAIMED_ON,
        bankLast5: CLAIM_SENTINEL,
      },
    ]);
  });

  it("rejects a full account number in the suffix column", () => {
    const snapshot = claimSnapshot("1234567890123");

    expect(buildRoomFeed(snapshot, "a", "2026-11-01T00:00:00.000Z")).toEqual({
      kind: "unavailable",
    });
    expect(buildPendingClaims(snapshot)).toEqual([]);
    expect(buildRoomFeed(snapshot, "b", "2026-11-01T00:00:00.000Z").kind).toBe(
      "ok",
    );
  });

  it("keeps claim values out of warnings and page metadata", () => {
    const claimsSource = read(join(repoRoot, "lib/appfeed/claims.ts"));
    const warnings = claimsSource.match(/console\.warn\([\s\S]*?\);/g) ?? [];

    expect(warnings.length).toBeGreaterThan(0);
    for (const warning of warnings) {
      expect(warning).not.toContain("bankLast5");
      expect(warning).not.toContain("claimedOn");
    }

    const roomPage = read(
      join(repoRoot, "app/[lang]/rooms/[room]/page.tsx"),
    );
    const metadata = roomPage.slice(
      roomPage.indexOf("export async function generateMetadata"),
      roomPage.indexOf("export default async function RoomPage"),
    );
    expect(metadata).not.toContain("bankLast5");
    expect(metadata).not.toContain("claimedOn");
  });

  it("uses a per-room cache tag and never a shared claim cache entry", () => {
    const feedSource = read(join(repoRoot, "lib/appfeed/feed.ts"));

    expect(feedSource).toContain("appfeed:room:${room}");
    expect(feedSource).not.toMatch(/appfeed:(?:claims|pending)/);
  });
});
