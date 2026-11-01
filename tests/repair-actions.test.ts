import { beforeEach, describe, expect, it, vi } from "vitest";
import { REPAIRS_HEADER } from "@/lib/appfeed/validate";

const mocks = vi.hoisted(() => ({
  getSessionClaims: vi.fn(),
  isAdminSession: vi.fn(),
  getRoomSessionVersion: vi.fn(),
  consumeAttempt: vi.fn(),
  fetchRepairsSnapshot: vi.fn(),
  appendRepairRow: vi.fn(),
  writeRepairDone: vi.fn(),
  acquireRepairDoneLock: vi.fn(),
  headers: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
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
  getSessionClaims: mocks.getSessionClaims,
  isAdminSession: mocks.isAdminSession,
}));

vi.mock("@/lib/session-version", () => ({
  getRoomSessionVersion: mocks.getRoomSessionVersion,
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

import { submitRepairAction } from "@/app/[lang]/rooms/[room]/repair-actions";
import { markRepairDoneAction } from "@/app/[lang]/admin/repair-actions";

const REQUEST_ID = "0123456789abcdef";

function form(
  category = "plumbing",
  note = "Leaking tap in the bathroom",
): FormData {
  const data = new FormData();
  data.set("category", category);
  data.set("note", note);
  return data;
}

function doneForm(requestId = REQUEST_ID, note?: string): FormData {
  const data = new FormData();
  data.set("requestId", requestId);
  if (note !== undefined) data.set("note", note);
  return data;
}

function repairSnapshot(rows: unknown[][]) {
  return { repairs: [[...REPAIRS_HEADER], ...rows] };
}

function pendingRow(overrides: Partial<Record<number, unknown>> = {}): unknown[] {
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

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getSessionClaims.mockResolvedValue({
    role: "tenant",
    room: "a",
    v: 4,
    exp: 1,
  });
  mocks.isAdminSession.mockResolvedValue(true);
  mocks.getRoomSessionVersion.mockResolvedValue(4);
  mocks.consumeAttempt.mockResolvedValue({
    allowed: true,
    retryAfterSeconds: null,
  });
  mocks.headers.mockResolvedValue({
    get: (name: string) => (name === "x-real-ip" ? "1.2.3.4" : null),
  });
  mocks.todayInTaipei.mockReturnValue("2026-11-01");
  mocks.fetchRepairsSnapshot.mockResolvedValue({
    kind: "ok",
    snapshot: { repairs: [[...REPAIRS_HEADER]] },
  });
  mocks.appendRepairRow.mockResolvedValue({ kind: "ok" });
  mocks.writeRepairDone.mockResolvedValue({ kind: "ok" });
  mocks.acquireRepairDoneLock.mockResolvedValue(async () => {});
});

describe("submitRepairAction", () => {
  it("submits a repair for the signed-in room", async () => {
    const state = await submitRepairAction(
      "zh-TW",
      "a",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "success" });
    expect(mocks.appendRepairRow).toHaveBeenCalledWith({
      room: "a",
      requestId: expect.stringMatching(/^[0-9a-f]{16}$/),
      category: "plumbing",
      note: "Leaking tap in the bathroom",
      submittedOn: "2026-11-01",
    });
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      "appfeed:repairs:room:a",
      { expire: 0 },
    );
  });

  it("returns a generic state when the accessor throws", async () => {
    mocks.appendRepairRow.mockRejectedValue(new Error("unexpected"));

    const state = await submitRepairAction(
      "en",
      "a",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "error", message: "generic" });
  });

  it("rejects an anonymous request before the write", async () => {
    mocks.getSessionClaims.mockResolvedValue(null);

    const state = await submitRepairAction(
      "en",
      "a",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "error", message: "generic" });
    expect(mocks.appendRepairRow).not.toHaveBeenCalled();
  });

  it("rejects an admin session before the write", async () => {
    mocks.getSessionClaims.mockResolvedValue({ role: "admin", exp: 1 });

    const state = await submitRepairAction(
      "en",
      "a",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "error", message: "generic" });
    expect(mocks.appendRepairRow).not.toHaveBeenCalled();
  });

  it("rejects another room before the write", async () => {
    const state = await submitRepairAction(
      "en",
      "b",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "error", message: "generic" });
    expect(mocks.appendRepairRow).not.toHaveBeenCalled();
  });

  it("rejects a session that an admin reset has revoked", async () => {
    mocks.getRoomSessionVersion.mockResolvedValue(5);

    const state = await submitRepairAction(
      "en",
      "a",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "error", message: "generic" });
    expect(mocks.appendRepairRow).not.toHaveBeenCalled();
  });

  it("rejects when the session version cannot be read", async () => {
    mocks.getRoomSessionVersion.mockRejectedValue(new Error("kv down"));

    const state = await submitRepairAction(
      "en",
      "a",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "error", message: "generic" });
    expect(mocks.appendRepairRow).not.toHaveBeenCalled();
  });

  it("rejects an invalid room path", async () => {
    const state = await submitRepairAction(
      "en",
      "z",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "error", message: "generic" });
    expect(mocks.appendRepairRow).not.toHaveBeenCalled();
  });

  it("returns the category error without appending", async () => {
    const state = await submitRepairAction(
      "en",
      "a",
      { status: "idle" },
      form("water", "Leaking tap"),
    );

    expect(state).toEqual({ status: "error", message: "category" });
    expect(mocks.appendRepairRow).not.toHaveBeenCalled();
  });

  it("returns the note error without appending", async () => {
    const state = await submitRepairAction(
      "en",
      "a",
      { status: "idle" },
      form("plumbing", "Contact jane@example.com"),
    );

    expect(state).toEqual({ status: "error", message: "note" });
    expect(mocks.appendRepairRow).not.toHaveBeenCalled();
  });

  it("returns unavailable when the Repairs tab is missing", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "unavailable",
      reason: "missing-tab",
      transient: false,
    });

    const state = await submitRepairAction(
      "en",
      "a",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "error", message: "unavailable" });
    expect(mocks.appendRepairRow).not.toHaveBeenCalled();
  });

  it("returns rate when the submit limit is exceeded", async () => {
    mocks.consumeAttempt.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 60,
    });

    const state = await submitRepairAction(
      "en",
      "a",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "error", message: "rate" });
    expect(mocks.appendRepairRow).not.toHaveBeenCalled();
  });

  it("returns unavailable when the append fails", async () => {
    mocks.appendRepairRow.mockResolvedValue({
      kind: "unavailable",
      reason: "timeout",
      transient: true,
    });

    const state = await submitRepairAction(
      "en",
      "a",
      { status: "idle" },
      form(),
    );

    expect(state).toEqual({ status: "error", message: "unavailable" });
    expect(mocks.appendRepairRow).toHaveBeenCalledTimes(1);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });
});

describe("markRepairDoneAction", () => {
  it("marks a pending request done and refreshes the room", async () => {
    mocks.fetchRepairsSnapshot
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: repairSnapshot([pendingRow()]),
      })
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: repairSnapshot([
          pendingRow({ 5: "done", 6: "2026-11-01" }),
        ]),
      });

    const state = await markRepairDoneAction(
      "en",
      { status: "idle" },
      doneForm(),
    );

    expect(state).toEqual({ status: "success" });
    expect(mocks.writeRepairDone).toHaveBeenCalledWith(2, "2026-11-01", "");
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      "appfeed:repairs:room:a",
      { expire: 0 },
    );
  });

  it("marks a pending request done with a trimmed note", async () => {
    mocks.fetchRepairsSnapshot
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: repairSnapshot([pendingRow()]),
      })
      .mockResolvedValueOnce({
        kind: "ok",
        snapshot: repairSnapshot([
          pendingRow({
            5: "done",
            6: "2026-11-01",
            7: "Fixed the tap",
          }),
        ]),
      });

    const state = await markRepairDoneAction(
      "en",
      { status: "idle" },
      doneForm(REQUEST_ID, "  Fixed the tap  "),
    );

    expect(state).toEqual({ status: "success" });
    expect(mocks.writeRepairDone).toHaveBeenCalledWith(
      2,
      "2026-11-01",
      "Fixed the tap",
    );
  });

  it("rejects an invalid note before the rate limit and write", async () => {
    const state = await markRepairDoneAction(
      "en",
      { status: "idle" },
      doneForm(REQUEST_ID, "Contact jane@example.com"),
    );

    expect(state).toEqual({ status: "error", message: "invalid-note" });
    expect(mocks.consumeAttempt).not.toHaveBeenCalled();
    expect(mocks.fetchRepairsSnapshot).not.toHaveBeenCalled();
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("rejects a non-string note without a write", async () => {
    const data = new FormData();
    data.set("requestId", REQUEST_ID);
    data.set("note", new File(["note"], "note.txt"));

    const state = await markRepairDoneAction("en", { status: "idle" }, data);

    expect(state).toEqual({ status: "error", message: "invalid-note" });
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("rejects a concurrent completion without a second write", async () => {
    mocks.acquireRepairDoneLock.mockResolvedValue(null);

    const state = await markRepairDoneAction(
      "en",
      { status: "idle" },
      doneForm(),
    );

    expect(state).toEqual({ status: "error", message: "unavailable" });
    expect(mocks.fetchRepairsSnapshot).not.toHaveBeenCalled();
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("returns a generic state when the accessor throws", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: repairSnapshot([pendingRow()]),
    });
    mocks.writeRepairDone.mockRejectedValue(new Error("unexpected"));

    const state = await markRepairDoneAction(
      "en",
      { status: "idle" },
      doneForm(),
    );

    expect(state).toEqual({ status: "error", message: "generic" });
  });

  it("rejects a non-string request ID without a write", async () => {
    const data = new FormData();
    data.set("requestId", new File(["id"], "id.txt"));

    const state = await markRepairDoneAction("en", { status: "idle" }, data);

    expect(state).toEqual({ status: "error", message: "not-found" });
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("rejects a non-admin caller before reading or writing", async () => {
    mocks.isAdminSession.mockResolvedValue(false);

    const state = await markRepairDoneAction(
      "en",
      { status: "idle" },
      doneForm(),
    );

    expect(state).toEqual({ status: "error", message: "generic" });
    expect(mocks.fetchRepairsSnapshot).not.toHaveBeenCalled();
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("returns already-done without writing", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: repairSnapshot([
        pendingRow({ 5: "done", 6: "2026-10-31" }),
      ]),
    });

    const state = await markRepairDoneAction(
      "en",
      { status: "idle" },
      doneForm(),
    );

    expect(state).toEqual({ status: "error", message: "already-done" });
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("returns not-found for an unknown request", async () => {
    const state = await markRepairDoneAction(
      "en",
      { status: "idle" },
      doneForm("fedcba9876543210"),
    );

    expect(state).toEqual({ status: "error", message: "not-found" });
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("rejects a malformed request ID before the rate limit", async () => {
    const state = await markRepairDoneAction(
      "en",
      { status: "idle" },
      doneForm("not-an-id"),
    );

    expect(state).toEqual({ status: "error", message: "not-found" });
    expect(mocks.consumeAttempt).not.toHaveBeenCalled();
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("returns unavailable when the tab is missing", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "unavailable",
      reason: "missing-tab",
      transient: false,
    });

    const state = await markRepairDoneAction(
      "en",
      { status: "idle" },
      doneForm(),
    );

    expect(state).toEqual({ status: "error", message: "unavailable" });
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("returns rate when the completion limit is exceeded", async () => {
    mocks.consumeAttempt.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 60,
    });

    const state = await markRepairDoneAction(
      "en",
      { status: "idle" },
      doneForm(),
    );

    expect(state).toEqual({ status: "error", message: "rate" });
    expect(mocks.fetchRepairsSnapshot).not.toHaveBeenCalled();
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("returns unavailable when the fresh read fails", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "unavailable",
      reason: "timeout",
      transient: true,
    });

    const state = await markRepairDoneAction(
      "en",
      { status: "idle" },
      doneForm(),
    );

    expect(state).toEqual({ status: "error", message: "unavailable" });
    expect(mocks.writeRepairDone).not.toHaveBeenCalled();
  });

  it("returns unavailable when the write fails and keeps the row pending", async () => {
    mocks.fetchRepairsSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: repairSnapshot([pendingRow()]),
    });
    mocks.writeRepairDone.mockResolvedValue({
      kind: "unavailable",
      reason: "server",
      transient: false,
    });

    const state = await markRepairDoneAction(
      "en",
      { status: "idle" },
      doneForm(),
    );

    expect(state).toEqual({ status: "error", message: "unavailable" });
    expect(mocks.writeRepairDone).toHaveBeenCalledTimes(1);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });
});
