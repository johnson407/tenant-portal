import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppFeedSnapshot } from "@/lib/appfeed/types";
import { BILLS_HEADER, LEASES_HEADER } from "@/lib/appfeed/validate";
import { ROOM_LETTERS, type RoomLetter } from "@/lib/rooms";

const mocks = vi.hoisted(() => ({
  fetchAppFeedSnapshot: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock("@/lib/appfeed/google", () => ({
  fetchAppFeedSnapshot: mocks.fetchAppFeedSnapshot,
}));

vi.mock("next/cache", () => ({
  cacheLife: mocks.cacheLife,
  cacheTag: mocks.cacheTag,
}));

import {
  AppFeedUnavailableError,
  getRoomFeed,
} from "@/lib/appfeed/feed";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function sentinelSnapshot(): AppFeedSnapshot {
  const bills: unknown[][] = [[...BILLS_HEADER]];
  const leases: unknown[][] = [[...LEASES_HEADER]];

  ROOM_LETTERS.forEach((room, index) => {
    const suffix = String(index + 1).padStart(2, "0");
    bills.push([
      room,
      `2026-${suffix}`,
      100000 + index,
      1000 + index,
      10 + index,
      `2026-12-${suffix}`,
      "",
      "",
      "",
      ...(index === 0 ? ["5000", "5100", "10", "", "", ""] : ["", "", "", "", "", ""]),
    ]);
    bills.push([
      room,
      `2025-${suffix}`,
      200000 + index,
      "",
      "",
      "2026-01-01",
      `2026-01-${suffix}`,
    ]);
    leases.push([
      room,
      `2026-${suffix}-01`,
      `2027-${suffix}-01`,
      "",
    ]);
  });

  return { bills, leases };
}

const SNAPSHOT = sentinelSnapshot();

beforeEach(() => {
  mocks.fetchAppFeedSnapshot.mockReset();
  mocks.cacheLife.mockReset();
  mocks.cacheTag.mockReset();
  mocks.fetchAppFeedSnapshot.mockResolvedValue({
    kind: "ok",
    snapshot: SNAPSHOT,
  });
});

describe("getRoomFeed", () => {
  it("queries only the requested room and never serializes other rooms", async () => {
    for (const room of ROOM_LETTERS) {
      mocks.fetchAppFeedSnapshot.mockClear();
      const result = await getRoomFeed(room);

      expect(result.kind).toBe("ok");
      if (result.kind !== "ok") continue;
      expect(result.feed.room).toBe(room);
      expect(result.feed.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(mocks.fetchAppFeedSnapshot).toHaveBeenCalledTimes(1);

      const serialized = JSON.stringify(result);
      ROOM_LETTERS.forEach((other, index) => {
        if (other === room) return;
        expect(serialized).not.toContain(String(100000 + index));
        expect(serialized).not.toContain(String(200000 + index));
        expect(serialized).not.toContain(
          `2026-${String(index + 1).padStart(2, "0")}-01`,
        );
      });
    }
  });

  it("projects a meter breakdown on an open bill and none on a payment", async () => {
    const roomA = await getRoomFeed("a");
    const roomB = await getRoomFeed("b");

    expect(roomA.kind).toBe("ok");
    expect(roomB.kind).toBe("ok");
    if (roomA.kind !== "ok" || roomB.kind !== "ok") return;

    expect(roomA.feed.openBills[0].waterBreakdown).toEqual({
      start: 5000,
      end: 5100,
      units: 100,
      rate: 10,
    });
    expect(roomA.feed.openBills[0].electricityBreakdown).toBeNull();
    expect(roomB.feed.openBills[0].waterBreakdown).toBeNull();

    expect(roomA.feed.payments[0]).toEqual({
      period: "2025-01",
      amount: 200000,
      receivedOn: "2026-01-01",
    });
    expect(Object.keys(roomA.feed.payments[0])).toEqual([
      "period",
      "amount",
      "receivedOn",
    ]);
  });

  it("keeps the latest confirmation outside the payment cap", async () => {
    const bills: unknown[][] = [[...BILLS_HEADER]];
    for (let month = 1; month <= 12; month += 1) {
      bills.push([
        "a",
        `2026-${String(month).padStart(2, "0")}`,
        "750",
        "",
        "",
        "2026-12-01",
        "2026-02-05",
        "2026-02-01",
        "01234",
        "",
        "",
        "",
        "",
        "",
        "",
        "2026-02-06",
        "",
      ]);
    }
    bills.push([
      "a",
      "2025-12",
      "750",
      "",
      "",
      "2025-12-01",
      "2025-01-01",
      "2025-01-01",
      "01234",
      "",
      "",
      "",
      "",
      "",
      "",
      "2026-11-01",
      "Old payment, newest confirmation",
    ]);

    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: { bills, leases: [[...LEASES_HEADER]] },
    });

    const result = await getRoomFeed("a");

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.payments).toHaveLength(12);
    expect(result.feed.lastConfirmation).toEqual({
      date: "2026-11-01",
      note: "Old payment, newest confirmation",
    });
  });

  it("uses the confirmation date, not the paid date", async () => {
    const bills: unknown[][] = [
      [...BILLS_HEADER],
      [
        "a",
        "2026-01",
        "750",
        "",
        "",
        "2026-01-01",
        "2026-09-08",
        "2026-08-01",
        "01234",
        "",
        "",
        "",
        "",
        "",
        "",
        "2026-09-10",
        "Newer confirmation",
      ],
      [
        "a",
        "2026-02",
        "750",
        "",
        "",
        "2026-02-01",
        "2026-09-09",
        "2026-08-01",
        "01234",
        "",
        "",
        "",
        "",
        "",
        "",
        "2026-09-09",
        "Newer payment",
      ],
    ];

    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: { bills, leases: [[...LEASES_HEADER]] },
    });

    const result = await getRoomFeed("a");

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.lastConfirmation).toEqual({
      date: "2026-09-10",
      note: "Newer confirmation",
    });
  });

  it("does not treat a manual paid date as a confirmation", async () => {
    const bills: unknown[][] = [
      [...BILLS_HEADER],
      [
        "a",
        "2026-01",
        "750",
        "",
        "",
        "2026-02-01",
        "2026-02-05",
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
    ];

    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: { bills, leases: [[...LEASES_HEADER]] },
    });

    const result = await getRoomFeed("a");

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.lastConfirmation).toBeNull();
  });

  it("uses the configured cache profile and per-room tag", async () => {
    await getRoomFeed("a");

    expect(mocks.cacheLife).toHaveBeenCalledWith({
      stale: 300,
      revalidate: 900,
      expire: 3600,
    });
    expect(mocks.cacheTag).toHaveBeenCalledWith("appfeed:room:a");
  });

  it("throws for an invalid room before reading the sheet", async () => {
    await expect(getRoomFeed("f" as RoomLetter)).rejects.toBeInstanceOf(
      AppFeedUnavailableError,
    );
    expect(mocks.fetchAppFeedSnapshot).not.toHaveBeenCalled();
  });

  it("throws for a transient snapshot failure so Next can serve stale data", async () => {
    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "unavailable",
      reason: "quota",
      transient: true,
    });

    await expect(getRoomFeed("a")).rejects.toBeInstanceOf(
      AppFeedUnavailableError,
    );
  });

  it("returns unavailable for a structural snapshot failure", async () => {
    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "unavailable",
      reason: "config",
      transient: false,
    });

    await expect(getRoomFeed("a")).resolves.toEqual({ kind: "unavailable" });
  });

  it("exports only the accessor and its error type", async () => {
    const module = await import("@/lib/appfeed/feed");
    expect(Object.keys(module).sort()).toEqual([
      "AppFeedUnavailableError",
      "getRoomFeed",
    ]);

    const source = readFileSync(
      join(repoRoot, "lib/appfeed/feed.ts"),
      "utf8",
    );
    expect(source).not.toMatch(
      /export\s+(?:type|interface|const|function|class)\s+(?:AppFeedSnapshot|SnapshotResult|SnapshotFailure|RoomFeed|FeedResult)/,
    );
  });

  it("is not imported by a route handler or Server Action", () => {
    function walk(directory: string): string[] {
      return readdirSync(directory).flatMap((name) => {
        const path = join(directory, name);
        return statSync(path).isDirectory()
          ? walk(path)
          : /(?:^|\/)(?:route\.tsx?|[^/]*actions\.tsx?)$/.test(path)
            ? [path]
            : [];
      });
    }

    const offenders = walk(join(repoRoot, "app")).filter((file) =>
      readFileSync(file, "utf8").includes("lib/appfeed/feed"),
    );

    expect(offenders).toEqual([]);
  });
});
