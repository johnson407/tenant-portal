import { beforeEach, describe, expect, it, vi } from "vitest";
import { REPAIRS_HEADER } from "@/lib/appfeed/validate";
import type { RepairsSnapshot } from "@/lib/appfeed/types";

const mocks = vi.hoisted(() => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
  headers: vi.fn(),
  isAdminSession: vi.fn(),
  consumeAttempt: vi.fn(),
  fetchRepairsSnapshot: vi.fn(),
  appendRepairRow: vi.fn(),
  writeRepairDone: vi.fn(),
  acquireRepairDoneLock: vi.fn(),
  todayInTaipei: vi.fn(),
}));

vi.mock("next/cache", () => ({
  cacheLife: mocks.cacheLife,
  cacheTag: mocks.cacheTag,
  revalidateTag: mocks.revalidateTag,
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@/lib/session-cookies", () => ({
  isAdminSession: mocks.isAdminSession,
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, consumeAttempt: mocks.consumeAttempt };
});

vi.mock("@/lib/appfeed/google", () => ({
  fetchRepairsSnapshot: mocks.fetchRepairsSnapshot,
  appendRepairRow: mocks.appendRepairRow,
  writeRepairDone: mocks.writeRepairDone,
}));

vi.mock("@/lib/appfeed/dates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/appfeed/dates")>();
  return { ...actual, todayInTaipei: mocks.todayInTaipei };
});

vi.mock("@/lib/appfeed/repair-lock", () => ({
  acquireRepairDoneLock: mocks.acquireRepairDoneLock,
}));

vi.mock("@/lib/appfeed/feed", () => {
  class AppFeedUnavailableError extends Error {
    constructor() {
      super("AppFeed unavailable");
      this.name = "AppFeedUnavailableError";
    }
  }
  return { AppFeedUnavailableError };
});

const {
  completeRepair,
  getRoomRepairs,
  listPendingRepairs,
  parseRepairInput,
  submitRepair,
} = await import("@/lib/appfeed/repairs");

const REQUEST_ID = "0123456789abcdef";
const OTHER_ID = "fedcba9876543210";

function validRepair(
  overrides: Partial<Record<number, unknown>> = {},
): unknown[] {
  const row: unknown[] = [
    "a",
    REQUEST_ID,
    "plumbing",
    "Leaking tap in the bathroom",
    "2026-10-30",
    "pending",
    "",
    "",
  ];
  for (const [index, value] of Object.entries(overrides)) {
    row[Number(index)] = value;
  }
  return row;
}

function makeSnapshot(rows: unknown[][]): RepairsSnapshot {
  return { repairs: [[...REPAIRS_HEADER], ...rows] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue({
    get: (name: string) => (name === "x-real-ip" ? "1.2.3.4" : null),
  });
  mocks.isAdminSession.mockResolvedValue(true);
  mocks.consumeAttempt.mockResolvedValue({
    allowed: true,
    retryAfterSeconds: null,
  });
  mocks.todayInTaipei.mockReturnValue("2026-11-01");
  mocks.fetchRepairsSnapshot.mockResolvedValue({
    kind: "ok",
    snapshot: makeSnapshot([validRepair()]),
  });
  mocks.appendRepairRow.mockResolvedValue({ kind: "ok" });
  mocks.writeRepairDone.mockResolvedValue({ kind: "ok" });
  mocks.acquireRepairDoneLock.mockResolvedValue(async () => {});
});

describe("getRoomRepairs", () => {
  it("returns only the requested room and caches with the repair tag", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: makeSnapshot([
        validRepair({ 0: "a", 3: "A leak" }),
        validRepair({ 0: "b", 1: OTHER_ID, 3: "B light" }),
      ]),
    });

    const result = await getRoomRepairs("a");

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.repairs).toHaveLength(1);
    expect(result.repairs[0].note).toBe("A leak");
    expect(JSON.stringify(result)).not.toContain("B light");
    expect(mocks.cacheLife).toHaveBeenCalledWith({
      stale: 300,
      revalidate: 900,
      expire: 3600,
    });
    expect(mocks.cacheTag).toHaveBeenCalledWith("appfeed:repairs:room:a");
  });

  it("keeps the latest done request outside the history cap", async () => {
    const rows = Array.from({ length: 20 }, (_, index) =>
      validRepair({
        1: index.toString(16).padStart(16, "0"),
        3: `Pending ${index}`,
        4: "2026-10-30",
      }),
    );
    rows.push(
      validRepair({
        1: "a".repeat(16),
        3: "Old done request",
        4: "2026-09-01",
        5: "done",
        6: "2026-09-02",
        7: "Old completion note",
      }),
    );

    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: makeSnapshot(rows),
    });

    const result = await getRoomRepairs("a");

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.repairs).toHaveLength(20);
    expect(result.repairs.every((repair) => repair.status === "pending")).toBe(
      true,
    );
    expect(result.lastDone).toEqual({
      date: "2026-09-02",
      note: "Old completion note",
    });
  });

  it("selects the latest done request by done date", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: makeSnapshot([
        validRepair({
          1: "a".repeat(16),
          3: "Older request",
          4: "2026-08-01",
          5: "done",
          6: "2026-08-02",
          7: "Older note",
        }),
        validRepair({
          1: "b".repeat(16),
          3: "Newest request",
          4: "2026-09-01",
          5: "done",
          6: "2026-09-10",
          7: "Newest note",
        }),
        validRepair({
          1: "c".repeat(16),
          3: "Middle request",
          4: "2026-08-15",
          5: "done",
          6: "2026-08-20",
        }),
      ]),
    });

    const result = await getRoomRepairs("a");

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.lastDone).toEqual({
      date: "2026-09-10",
      note: "Newest note",
    });
  });

  it("returns unavailable, not empty, when the tab is missing", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "unavailable",
      reason: "missing-tab",
      transient: false,
    });

    await expect(getRoomRepairs("a")).resolves.toEqual({
      kind: "unavailable",
    });
  });

  it("throws for a transient read failure", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "unavailable",
      reason: "timeout",
      transient: true,
    });

    await expect(getRoomRepairs("a")).rejects.toThrow("AppFeed unavailable");
  });

  it("rejects an invalid runtime room", async () => {
    await expect(getRoomRepairs("f" as "a")).rejects.toThrow(
      "AppFeed unavailable",
    );
  });
});

describe("listPendingRepairs", () => {
  it("denies a tenant or anonymous caller before reading", async () => {
    mocks.isAdminSession.mockResolvedValue(false);

    await expect(listPendingRepairs()).resolves.toEqual({ kind: "denied" });
    expect(mocks.fetchRepairsSnapshot).not.toHaveBeenCalled();
  });

  it("returns pending requests with a narrow projection", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: makeSnapshot([
        validRepair({ 3: "Pending request" }),
        validRepair({
          1: OTHER_ID,
          3: "Done request",
          5: "done",
          6: "2026-10-31",
        }),
      ]),
    });

    const result = await listPendingRepairs();

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.repairs).toHaveLength(1);
    expect(Object.keys(result.repairs[0]).sort()).toEqual([
      "category",
      "note",
      "requestId",
      "room",
      "submittedOn",
    ]);
    expect(result.repairs[0].note).toBe("Pending request");
  });

  it("returns unavailable when the tab is missing", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "unavailable",
      reason: "missing-tab",
      transient: false,
    });

    await expect(listPendingRepairs()).resolves.toEqual({
      kind: "unavailable",
    });
  });

  it("returns unavailable when any attributed row is invalid", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: makeSnapshot([
        validRepair({ 3: "Contact jane@example.com" }),
      ]),
    });

    await expect(listPendingRepairs()).resolves.toEqual({
      kind: "unavailable",
    });
  });
});

describe("parseRepairInput", () => {
  it("trims a valid note and returns the category", () => {
    expect(
      parseRepairInput({ category: "plumbing", note: "  Leaking tap  " }),
    ).toEqual({
      ok: true,
      value: { category: "plumbing", note: "Leaking tap" },
    });
  });

  it.each([
    ["an unknown category", { category: "water", note: "Leak" }, "category"],
    ["a blank note", { category: "plumbing", note: "   " }, "note"],
    [
      "a note with an email",
      { category: "plumbing", note: "Contact jane@example.com" },
      "note",
    ],
  ])("rejects %s", (_label, input, reason) => {
    expect(parseRepairInput(input)).toEqual({ ok: false, reason });
  });

  it("rejects a non-string category or note", () => {
    expect(
      parseRepairInput({
        category: new File(["plumbing"], "category.txt"),
        note: "Leaking tap",
      }),
    ).toEqual({ ok: false, reason: "category" });
    expect(
      parseRepairInput({
        category: "plumbing",
        note: new File(["Leaking tap"], "note.txt"),
      }),
    ).toEqual({ ok: false, reason: "note" });
  });
});

describe("submitRepair", () => {
  it("appends one pending row with server values and refreshes the room", async () => {
    const result = await submitRepair("a", {
      category: "plumbing",
      note: "Leaking tap",
    });

    expect(result).toEqual({ kind: "ok" });
    expect(mocks.appendRepairRow).toHaveBeenCalledWith({
      room: "a",
      requestId: expect.stringMatching(/^[0-9a-f]{16}$/),
      category: "plumbing",
      note: "Leaking tap",
      submittedOn: "2026-11-01",
    });
    expect(mocks.consumeAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "ratelimit:repair-submit" }),
      ["ip:1.2.3.4", "room:a"],
    );
    expect(mocks.revalidateTag).toHaveBeenCalledTimes(1);
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      "appfeed:repairs:room:a",
      { expire: 0 },
    );
    expect(mocks.revalidateTag).not.toHaveBeenCalledWith(
      "appfeed:room:a",
      expect.anything(),
    );
  });

  it("rejects an invalid category before the rate limit or read", async () => {
    const result = await submitRepair("a", {
      category: "water",
      note: "Leaking tap",
    });

    expect(result).toEqual({ kind: "error", reason: "category" });
    expect(mocks.consumeAttempt).not.toHaveBeenCalled();
    expect(mocks.fetchRepairsSnapshot).not.toHaveBeenCalled();
    expect(mocks.appendRepairRow).not.toHaveBeenCalled();
  });

  it("rejects an invalid note before the rate limit or read", async () => {
    const result = await submitRepair("a", {
      category: "plumbing",
      note: "Contact jane@example.com",
    });

    expect(result).toEqual({ kind: "error", reason: "note" });
    expect(mocks.consumeAttempt).not.toHaveBeenCalled();
    expect(mocks.appendRepairRow).not.toHaveBeenCalled();
  });

  it("rejects an invalid room before any work", async () => {
    const result = await submitRepair("f" as "a", {
      category: "plumbing",
      note: "Leaking tap",
    });

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.consumeAttempt).not.toHaveBeenCalled();
  });

  it("returns rate when the limit is exceeded", async () => {
    mocks.consumeAttempt.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 60,
    });

    const result = await submitRepair("a", {
      category: "plumbing",
      note: "Leaking tap",
    });

    expect(result).toEqual({ kind: "error", reason: "rate" });
    expect(mocks.fetchRepairsSnapshot).not.toHaveBeenCalled();
    expect(mocks.appendRepairRow).not.toHaveBeenCalled();
  });

  it("fails closed when the rate-limit store is unavailable", async () => {
    mocks.consumeAttempt.mockRejectedValue(
      new Error("KV store is not configured"),
    );

    const result = await submitRepair("a", {
      category: "plumbing",
      note: "Leaking tap",
    });

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.appendRepairRow).not.toHaveBeenCalled();
  });

  it("rejects a missing tab before the append", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "unavailable",
      reason: "missing-tab",
      transient: false,
    });

    const result = await submitRepair("a", {
      category: "plumbing",
      note: "Leaking tap",
    });

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.appendRepairRow).not.toHaveBeenCalled();
  });

  it("rejects a submit when the room has an invalid repair row", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: makeSnapshot([
        validRepair({ 3: "Contact jane@example.com" }),
      ]),
    });

    const result = await submitRepair("a", {
      category: "plumbing",
      note: "Leaking tap",
    });

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.appendRepairRow).not.toHaveBeenCalled();
  });

  it("ignores an invalid repair row for another room", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: makeSnapshot([
        validRepair(),
        validRepair({
          0: "b",
          1: OTHER_ID,
          3: "Contact jane@example.com",
        }),
      ]),
    });

    const result = await submitRepair("a", {
      category: "plumbing",
      note: "Leaking tap",
    });

    expect(result).toEqual({ kind: "ok" });
    expect(mocks.appendRepairRow).toHaveBeenCalledWith(
      expect.objectContaining({ room: "a" }),
    );
  });

  it("returns unavailable when the append fails and does not refresh", async () => {
    mocks.appendRepairRow.mockResolvedValue({
      kind: "unavailable",
      reason: "timeout",
      transient: true,
    });

    const result = await submitRepair("a", {
      category: "plumbing",
      note: "Leaking tap",
    });

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });
});

describe("completeRepair", () => {
  function mockCompletionReads(room: "a" | "b" = "a") {
    mocks.fetchRepairsSnapshot
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: makeSnapshot([validRepair({ 0: room })]),
      })
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: makeSnapshot([
          validRepair({ 0: room, 5: "done", 6: "2026-11-01" }),
        ]),
      });
  }

  it("marks a pending request done and refreshes its room", async () => {
    mockCompletionReads();

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "ok" });
    expect(mocks.writeRepairDone).toHaveBeenCalledWith(2, "2026-11-01", "");
    expect(mocks.revalidateTag).toHaveBeenCalledTimes(1);
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      "appfeed:repairs:room:a",
      { expire: 0 },
    );
  });

  it("rejects a concurrent completion before the second write", async () => {
    mocks.acquireRepairDoneLock.mockResolvedValue(null);

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.fetchRepairsSnapshot).not.toHaveBeenCalled();
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("fails closed when the completion lock store is unavailable", async () => {
    mocks.acquireRepairDoneLock.mockRejectedValue(
      new Error("KV store is not configured"),
    );

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.fetchRepairsSnapshot).not.toHaveBeenCalled();
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("releases the completion lock after a successful write", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    mocks.acquireRepairDoneLock.mockResolvedValue(release);
    mockCompletionReads();

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "ok" });
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("releases the completion lock after a rejected write", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    mocks.acquireRepairDoneLock.mockResolvedValue(release);
    mocks.writeRepairDone.mockResolvedValue({
      kind: "unavailable",
      reason: "server",
      transient: false,
    });

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("rejects when the row moves between the read and the write", async () => {
    mocks.fetchRepairsSnapshot
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: makeSnapshot([validRepair()]),
      })
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: makeSnapshot([
          validRepair({ 1: OTHER_ID, 3: "Inserted row" }),
          validRepair({ 5: "done", 6: "2026-11-01" }),
        ]),
      });

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects when the request is still pending after the write", async () => {
    mocks.fetchRepairsSnapshot
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: makeSnapshot([validRepair()]),
      })
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: makeSnapshot([validRepair()]),
      });

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects when the done date does not match after the write", async () => {
    mocks.fetchRepairsSnapshot
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: makeSnapshot([validRepair()]),
      })
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: makeSnapshot([
          validRepair({ 5: "done", 6: "2026-10-31" }),
        ]),
      });

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects a request that is already done", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: makeSnapshot([
        validRepair({ 5: "done", 6: "2026-10-31" }),
      ]),
    });

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "error", reason: "already-done" });
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects an unknown request ID", async () => {
    const result = await completeRepair(OTHER_ID);

    expect(result).toEqual({ kind: "error", reason: "not-found" });
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("rejects a malformed request ID before the rate limit", async () => {
    const result = await completeRepair("not-an-id");

    expect(result).toEqual({ kind: "error", reason: "not-found" });
    expect(mocks.consumeAttempt).not.toHaveBeenCalled();
  });

  it("denies a tenant or anonymous caller before reading", async () => {
    mocks.isAdminSession.mockResolvedValue(false);

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "denied" });
    expect(mocks.consumeAttempt).not.toHaveBeenCalled();
    expect(mocks.fetchRepairsSnapshot).not.toHaveBeenCalled();
  });

  it("returns unavailable when the tab is missing", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "unavailable",
      reason: "missing-tab",
      transient: false,
    });

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("returns unavailable when the fresh read fails", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "unavailable",
      reason: "timeout",
      transient: true,
    });

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("returns unavailable when any tab row is invalid", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: makeSnapshot([
        validRepair(),
        validRepair({ 1: OTHER_ID, 3: "Contact jane@example.com" }),
      ]),
    });

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("returns unavailable when the write fails", async () => {
    mocks.writeRepairDone.mockResolvedValue({
      kind: "unavailable",
      reason: "server",
      transient: false,
    });

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("returns rate when the completion limit is exceeded", async () => {
    mocks.consumeAttempt.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 60,
    });

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "error", reason: "rate" });
    expect(mocks.fetchRepairsSnapshot).not.toHaveBeenCalled();
  });

  it("fails closed when the completion store is unavailable", async () => {
    mocks.consumeAttempt.mockRejectedValue(
      new Error("KV store is not configured"),
    );

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.fetchRepairsSnapshot).not.toHaveBeenCalled();
  });

  it("refuses a completion date before the submitted date", async () => {
    mocks.todayInTaipei.mockReturnValue("2026-10-29");

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "error", reason: "unavailable" });
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("refreshes only the row's room", async () => {
    mockCompletionReads("b");

    const result = await completeRepair(REQUEST_ID);

    expect(result).toEqual({ kind: "ok" });
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      "appfeed:repairs:room:b",
      { expire: 0 },
    );
    expect(mocks.revalidateTag).not.toHaveBeenCalledWith(
      "appfeed:room:b",
      expect.anything(),
    );
  });
});
