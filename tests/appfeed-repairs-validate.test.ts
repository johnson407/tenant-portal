import { afterEach, describe, expect, it, vi } from "vitest";
import {
  REPAIR_CATEGORIES,
  REPAIR_ID_PATTERN,
  REPAIR_NOTE_MAX,
  REPAIRS_HEADER,
  REPAIRS_RANGE,
  buildAdminRepairs,
  buildPendingRepairs,
  buildRoomRepairs,
  isValidNote,
  isValidOptionalNote,
  isValidRepairNote,
  parseRepairRow,
  validateRepairs,
} from "@/lib/appfeed/validate";
import type { RepairsSnapshot } from "@/lib/appfeed/types";

function validRepair(overrides: Partial<Record<number, unknown>> = {}): unknown[] {
  const row: unknown[] = [
    "a",
    "0123456789abcdef",
    "plumbing",
    "Leaking tap in the bathroom",
    "2026-10-30",
    "pending",
    "",
    "",
    "",
    "",
    "",
  ];
  for (const [index, value] of Object.entries(overrides)) {
    row[Number(index)] = value;
  }
  return row;
}

function makeRepairsSnapshot(rows: unknown[][] = []): RepairsSnapshot {
  return { repairs: [[...REPAIRS_HEADER], ...rows] };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Repairs schema constants", () => {
  it("exports the exact header, range, categories, and request ID pattern", () => {
    expect([...REPAIRS_HEADER]).toEqual([
      "room",
      "request_id",
      "category",
      "note",
      "submitted_on",
      "status",
      "done_on",
      "done_note",
      "visit_start",
      "visit_end",
      "expense_amount",
    ]);
    expect(REPAIRS_RANGE).toBe("Repairs!A:K");
    expect([...REPAIR_CATEGORIES]).toEqual([
      "plumbing",
      "electrical",
      "appliance",
      "other",
    ]);
    expect(REPAIR_ID_PATTERN.source).toBe("^[0-9a-f]{16}$");
    expect(REPAIR_NOTE_MAX).toBe(200);
  });
});

describe("repair note rules", () => {
  it("accepts a short plain note", () => {
    expect(isValidRepairNote("Leaking tap in the bathroom")).toBe(true);
  });

  it("accepts exactly 200 characters", () => {
    expect(isValidRepairNote("a".repeat(200))).toBe(true);
  });

  it("accepts 200 characters followed by trailing spaces", () => {
    expect(isValidRepairNote("a".repeat(200) + "   ")).toBe(true);
  });

  it("counts code points, not UTF-16 units", () => {
    expect(isValidRepairNote("😀".repeat(200))).toBe(true);
    expect(isValidRepairNote("😀".repeat(201))).toBe(false);
  });

  it("accepts a note with a date", () => {
    expect(isValidRepairNote("Started on 2026-10-30")).toBe(true);
  });

  it("accepts six digits in a row", () => {
    expect(isValidRepairNote("Code 123456")).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
    ["201 characters", "a".repeat(201)],
    ["line break", "Leaking\ntap"],
    ["tab", "Leaking\ttap"],
    ["null character", "Leaking\u0000tap"],
    ["email address", "Contact jane@example.com"],
    ["https URL", "See https://example.com/repair"],
    ["www URL", "See www.example.com"],
    ["seven digits", "Call 0912345"],
    ["long digit run", "Account 123456789"],
    ["full-width digits", "Call \uFF10\uFF19\uFF11\uFF12\uFF13\uFF14\uFF15\uFF16\uFF17"],
    ["full-width at sign", "Contact jane\uFF20example.com"],
    ["full-width URL", "See \uFF48\uFF54\uFF54\uFF50\uFF1A\uFF0F\uFF0Fexample.com"],
    ["ftp URL", "See ftp://example.com/file"],
    ["mailto address", "Write to mailto:jane@example.com"],
    ["line.me URL", "See line.me/abc"],
    ["bare domain", "See example.com"],
    ["line separator", "Leaking\u2028tap"],
    ["paragraph separator", "Leaking\u2029tap"],
    ["right-to-left override", "Leaking \u202Etap"],
    ["zero-width space", "Leaking\u200Btap"],
    ["byte order mark", "\uFEFFLeaking tap"],
  ])("rejects %s", (_label, value) => {
    expect(isValidRepairNote(value)).toBe(false);
  });

  it("uses the same rules for shared and optional notes", () => {
    expect(isValidNote("Washer replaced")).toBe(true);
    expect(isValidNote("")).toBe(false);
    expect(isValidOptionalNote("")).toBe(true);
    expect(isValidOptionalNote("   ")).toBe(true);
    expect(isValidOptionalNote("See https://example.com")).toBe(false);
    expect(isValidRepairNote("Washer replaced")).toBe(isValidNote("Washer replaced"));
  });
});

describe("parseRepairRow", () => {
  it("parses a pending request with a blank done date", () => {
    expect(parseRepairRow(validRepair())).toEqual({
      room: "a",
      requestId: "0123456789abcdef",
      category: "plumbing",
      note: "Leaking tap in the bathroom",
      submittedOn: "2026-10-30",
      status: "pending",
      doneOn: null,
      doneNote: null,
      visitStart: null,
      visitEnd: null,
      expenseAmount: null,
    });
  });

  it("parses a completed row with visit times and a whole-dollar expense", () => {
    expect(
      parseRepairRow(
        validRepair({
          5: "done",
          6: "2026-11-01",
          8: "2026-11-04T09:00+08:00",
          9: "2026-11-04T12:00+08:00",
          10: "0",
        }),
      ),
    ).toMatchObject({
      status: "done",
      visitStart: "2026-11-04T09:00+08:00",
      visitEnd: "2026-11-04T12:00+08:00",
      expenseAmount: 0,
    });
  });

  it("rejects an in-progress row with a recorded expense amount", () => {
    expect(parseRepairRow(validRepair({ 5: "in_progress", 10: "1250" }))).toBe(
      null,
    );
  });

  it("parses a done request with a later done date", () => {
    expect(
      parseRepairRow(
        validRepair({ 5: "done", 6: "2026-11-01" }),
      ),
    ).toMatchObject({
      status: "done",
      doneOn: "2026-11-01",
    });
  });

  it("parses a done request with a trimmed completion note", () => {
    expect(
      parseRepairRow(
        validRepair({
          5: "done",
          6: "2026-11-01",
          7: "  Washer replaced  ",
        }),
      ),
    ).toMatchObject({
      status: "done",
      doneOn: "2026-11-01",
      doneNote: "Washer replaced",
    });
  });

  it("accepts a done date on the submitted date", () => {
    expect(
      parseRepairRow(validRepair({ 5: "done", 6: "2026-10-30" })),
    ).toMatchObject({ status: "done", doneOn: "2026-10-30" });
  });

  it("accepts a leap day as a real date", () => {
    expect(
      parseRepairRow(
        validRepair({ 4: "2024-02-29", 5: "done", 6: "2024-03-01" }),
      ),
    ).toMatchObject({ submittedOn: "2024-02-29", doneOn: "2024-03-01" });
  });

  it("trims the room, request ID, category, note, and dates", () => {
    expect(
      parseRepairRow(
        validRepair({
          0: " A ",
          1: " 0123456789abcdef ",
          2: " plumbing ",
          3: "  Leaking tap  ",
          4: " 2026-10-30 ",
          5: " pending ",
        }),
      ),
    ).toMatchObject({
      room: "a",
      requestId: "0123456789abcdef",
      category: "plumbing",
      note: "Leaking tap",
      submittedOn: "2026-10-30",
      status: "pending",
    });
  });

  it.each([
    ["room F", { 0: "f" }],
    ["blank room", { 0: "" }],
    ["short request ID", { 1: "0123456789abcde" }],
    ["long request ID", { 1: "0123456789abcdef0" }],
    ["uppercase request ID", { 1: "0123456789ABCDEF" }],
    ["non-hex request ID", { 1: "0123456789abcdeg" }],
    ["unknown category", { 2: "water" }],
    ["blank category", { 2: "" }],
    ["blank note", { 3: "" }],
    ["note with an email", { 3: "Contact jane@example.com" }],
    ["note with a URL", { 3: "See https://example.com" }],
    ["note with seven digits", { 3: "Call 0912345" }],
    ["impossible submitted date", { 4: "2026-02-30" }],
    ["unknown status", { 5: "open" }],
    ["uppercase status", { 5: "PENDING" }],
    ["scheduled without a visit window", { 5: "scheduled" }],
    ["partial visit window", { 8: "2026-11-04T09:00+08:00" }],
    [
      "reversed visit window",
      {
        8: "2026-11-04T12:00+08:00",
        9: "2026-11-04T09:00+08:00",
      },
    ],
    ["impossible visit time", { 8: "2026-11-04T24:00+08:00", 9: "2026-11-04T25:00+08:00" }],
    ["visit with wrong UTC offset", { 8: "2026-11-04T09:00Z", 9: "2026-11-04T12:00Z" }],
    ["fractional expense", { 10: "12.5" }],
    ["negative expense", { 10: "-12" }],
    ["formatted expense", { 10: "1,250" }],
    ["pending with a done date", { 6: "2026-10-31" }],
    ["pending with a completion note", { 7: "Already fixed" }],
    ["done with an invalid completion note", { 5: "done", 6: "2026-11-01", 7: "See https://example.com" }],
    ["done with a blank done date", { 5: "done" }],
    ["done with an impossible date", { 5: "done", 6: "2026-02-30" }],
    [
      "done before submitted",
      { 4: "2026-10-30", 5: "done", 6: "2026-10-29" },
    ],
  ])("rejects %s", (_label, overrides) => {
    expect(parseRepairRow(validRepair(overrides))).toBeNull();
  });
});

describe("validateRepairs", () => {
  it("accepts a header-only tab as an empty valid snapshot", () => {
    expect(validateRepairs(makeRepairsSnapshot())).toEqual({
      ok: true,
      repairs: [],
      invalidRooms: new Map(),
      droppedRepairs: 0,
    });
  });

  it("rejects a wrong header", () => {
    const snapshot: RepairsSnapshot = {
      repairs: [[...REPAIRS_HEADER].slice(0, 6)],
    };
    expect(validateRepairs(snapshot)).toEqual({ ok: false });
  });

  it("rejects a row wider than the range", () => {
    const snapshot = makeRepairsSnapshot([[...validRepair(), "extra"]]);
    expect(validateRepairs(snapshot)).toEqual({ ok: false });
  });

  it("rejects a non-array row", () => {
    const snapshot = {
      repairs: [[...REPAIRS_HEADER], "not-a-row"],
    } as unknown as RepairsSnapshot;
    expect(validateRepairs(snapshot)).toEqual({ ok: false });
  });

  it("ignores fully empty rows", () => {
    const snapshot = makeRepairsSnapshot([
      ["", " ", null, undefined, "", "", ""],
      validRepair(),
    ]);
    const result = validateRepairs(snapshot);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.repairs).toHaveLength(1);
    expect(result.droppedRepairs).toBe(0);
  });

  it("drops and counts a row with an invalid room cell", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const snapshot = makeRepairsSnapshot([
      validRepair({ 0: "z", 3: "Dropped request" }),
      validRepair({ 1: "1111111111111111", 3: "Kept request" }),
    ]);
    const result = validateRepairs(snapshot);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.repairs).toHaveLength(1);
    expect(result.repairs[0].note).toBe("Kept request");
    expect(result.droppedRepairs).toBe(1);
    expect(warn).toHaveBeenCalledWith("[appfeed] unattributable rows ignored", {
      repairs: 1,
    });
  });

  it("invalidates both rooms when a request ID repeats", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const snapshot = makeRepairsSnapshot([
      validRepair({ 0: "a", 1: "2222222222222222" }),
      validRepair({ 0: "b", 1: "2222222222222222" }),
    ]);
    const result = validateRepairs(snapshot);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invalidRooms.get("a")).toBe(1);
    expect(result.invalidRooms.get("b")).toBe(1);
    expect(result.repairs).toHaveLength(1);
  });
});

describe("buildRoomRepairs", () => {
  it("projects only the requested room and hides other room values", () => {
    const snapshot = makeRepairsSnapshot([
      validRepair({ 0: "a", 1: "1111111111111111", 3: "A leak" }),
      validRepair({ 0: "b", 1: "2222222222222222", 3: "B light" }),
    ]);
    const result = buildRoomRepairs(snapshot, "a");

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.repairs).toEqual([
      {
        requestId: "1111111111111111",
        category: "plumbing",
        note: "A leak",
        submittedOn: "2026-10-30",
        status: "pending",
        visitStart: null,
        visitEnd: null,
        doneOn: null,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("B light");
  });

  it("returns an empty history for a header-only tab", () => {
    expect(buildRoomRepairs(makeRepairsSnapshot(), "a")).toEqual({
      kind: "ok",
      repairs: [],
      lastDone: null,
    });
  });

  it("puts pending first, newest pending first, then done newest first", () => {
    const snapshot = makeRepairsSnapshot([
      validRepair({
        1: "1111111111111111",
        3: "Newer pending",
        4: "2026-11-02",
      }),
      validRepair({
        1: "2222222222222222",
        3: "Older pending",
        4: "2026-10-30",
      }),
      validRepair({
        1: "3333333333333333",
        3: "Done request",
        4: "2026-10-01",
        5: "done",
        6: "2026-11-03",
      }),
    ]);
    const result = buildRoomRepairs(snapshot, "a");

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.repairs.map((repair) => repair.note)).toEqual([
      "Newer pending",
      "Older pending",
      "Done request",
    ]);
  });

  it("sorts done requests by the latest done date", () => {
    const snapshot = makeRepairsSnapshot([
      validRepair({
        1: "1111111111111111",
        3: "Earlier done",
        4: "2026-10-01",
        5: "done",
        6: "2026-11-01",
      }),
      validRepair({
        1: "2222222222222222",
        3: "Later done",
        4: "2026-10-02",
        5: "done",
        6: "2026-11-03",
      }),
    ]);
    const result = buildRoomRepairs(snapshot, "a");

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.repairs.map((repair) => repair.note)).toEqual([
      "Later done",
      "Earlier done",
    ]);
  });

  it("keeps the newest 20 requests when the history is full", () => {
    const rows = Array.from({ length: 25 }, (_, index) =>
      validRepair({
        1: index.toString(16).padStart(16, "0"),
        3: `Request ${index}`,
        4: `2026-10-${String(index + 1).padStart(2, "0")}`,
      }),
    );
    const result = buildRoomRepairs(makeRepairsSnapshot(rows), "a");

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.repairs).toHaveLength(20);
    expect(result.repairs[0]).toMatchObject({
      requestId: "0000000000000018",
      note: "Request 24",
    });
    expect(result.repairs[19]).toMatchObject({
      requestId: "0000000000000005",
      note: "Request 5",
    });
    expect(result.repairs.map((repair) => repair.note)).not.toContain(
      "Request 0",
    );
  });

  it("returns unavailable for an invalid room argument", () => {
    expect(
      buildRoomRepairs(makeRepairsSnapshot([validRepair()]), "f" as "a"),
    ).toEqual({ kind: "unavailable" });
  });

  it("blocks only the room with an invalid row", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const snapshot = makeRepairsSnapshot([
      validRepair({ 0: "a", 3: "Contact jane@example.com" }),
      validRepair({ 0: "b", 1: "2222222222222222", 3: "B is valid" }),
    ]);

    expect(buildRoomRepairs(snapshot, "a")).toEqual({ kind: "unavailable" });
    const roomB = buildRoomRepairs(snapshot, "b");
    expect(roomB.kind).toBe("ok");
    if (roomB.kind !== "ok") return;
    expect(roomB.repairs[0].note).toBe("B is valid");
  });

  it("shows no partial list when one room row is invalid", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const snapshot = makeRepairsSnapshot([
      validRepair({ 1: "1111111111111111", 3: "Valid one" }),
      validRepair({ 1: "2222222222222222", 3: "Valid two" }),
      validRepair({ 1: "3333333333333333", 3: "Contact jane@example.com" }),
    ]);

    expect(buildRoomRepairs(snapshot, "a")).toEqual({ kind: "unavailable" });
  });

  it("is unavailable when the header is wrong", () => {
    const snapshot: RepairsSnapshot = {
      repairs: [[...REPAIRS_HEADER].slice(0, 6)],
    };
    expect(buildRoomRepairs(snapshot, "a")).toEqual({ kind: "unavailable" });
  });

  it("projects visit times and status without expense data", () => {
    const result = buildRoomRepairs(
      makeRepairsSnapshot([
        validRepair({
          5: "scheduled",
          8: "2026-11-04T09:00+08:00",
          9: "2026-11-04T12:00+08:00",
          10: "",
        }),
      ]),
      "a",
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.repairs[0]).toMatchObject({
      status: "scheduled",
      visitStart: "2026-11-04T09:00+08:00",
      visitEnd: "2026-11-04T12:00+08:00",
    });
    expect(result.repairs[0]).not.toHaveProperty("expenseAmount");
  });
});

describe("buildPendingRepairs", () => {
  it("returns pending requests across rooms, oldest first", () => {
    const snapshot = makeRepairsSnapshot([
      validRepair({
        0: "b",
        1: "2222222222222222",
        3: "B pending",
        4: "2026-11-02",
      }),
      validRepair({
        0: "a",
        1: "1111111111111111",
        3: "A pending",
        4: "2026-10-30",
      }),
      validRepair({
        0: "a",
        1: "3333333333333333",
        3: "A done",
        4: "2026-09-01",
        5: "done",
        6: "2026-09-02",
      }),
    ]);
    const queue = buildPendingRepairs(snapshot);

    expect(queue).toEqual([
      {
        room: "a",
        requestId: "1111111111111111",
        category: "plumbing",
        note: "A pending",
        submittedOn: "2026-10-30",
      },
      {
        room: "b",
        requestId: "2222222222222222",
        category: "plumbing",
        note: "B pending",
        submittedOn: "2026-11-02",
      },
    ]);
  });

  it("returns an empty queue for a header-only tab", () => {
    expect(buildPendingRepairs(makeRepairsSnapshot())).toEqual([]);
  });

  it("returns null when any attributed row is invalid", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const snapshot = makeRepairsSnapshot([
      validRepair({ 0: "a", 3: "Contact jane@example.com" }),
      validRepair({ 0: "b", 1: "2222222222222222" }),
    ]);

    expect(buildPendingRepairs(snapshot)).toBeNull();
  });

  it("still returns valid requests when an invalid room cell is dropped", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const snapshot = makeRepairsSnapshot([
      validRepair({ 0: "z", 3: "Dropped request" }),
      validRepair({ 0: "a", 1: "1111111111111111", 3: "Kept request" }),
    ]);
    const queue = buildPendingRepairs(snapshot);

    expect(queue).toHaveLength(1);
    expect(queue?.[0].note).toBe("Kept request");
  });

  it("returns null for a duplicate request ID", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const snapshot = makeRepairsSnapshot([
      validRepair({ 0: "a", 1: "2222222222222222" }),
      validRepair({ 0: "b", 1: "2222222222222222" }),
    ]);

    expect(buildPendingRepairs(snapshot)).toBeNull();
  });

  it("returns null for a wrong header", () => {
    const snapshot: RepairsSnapshot = {
      repairs: [[...REPAIRS_HEADER].slice(0, 6)],
    };
    expect(buildPendingRepairs(snapshot)).toBeNull();
  });
});

describe("buildAdminRepairs", () => {
  it("projects all rooms and sums recorded expenses, including zero", () => {
    const projection = buildAdminRepairs(
      makeRepairsSnapshot([
        validRepair({
          0: "b",
          1: "2222222222222222",
          5: "done",
          6: "2026-11-01",
          10: "1250",
        }),
        validRepair({
          0: "a",
          1: "1111111111111111",
          5: "done",
          6: "2026-10-31",
          10: "0",
        }),
        validRepair({ 0: "c", 1: "3333333333333333", 10: "" }),
      ]),
    );

    expect(projection?.expenseTotal).toBe(1250);
    expect(projection?.repairs.map((repair) => repair.status)).toEqual([
      "pending",
      "done",
      "done",
    ]);
    expect(projection?.repairs.map((repair) => repair.room)).toEqual([
      "c",
      "b",
      "a",
    ]);
    expect(projection?.repairs[1].expenseAmount).toBe(1250);
  });

  it("returns null when any repair row is invalid", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const projection = buildAdminRepairs(
      makeRepairsSnapshot([
        validRepair({ 10: "100" }),
        validRepair({ 0: "b", 1: "2222222222222222", 3: "Contact jane@example.com" }),
      ]),
    );
    expect(projection).toBeNull();
  });

  it("returns null when a nonblank repair row has an invalid room", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const projection = buildAdminRepairs(
      makeRepairsSnapshot([
        validRepair({ 5: "done", 6: "2026-11-01", 10: "100" }),
        validRepair({
          0: "z",
          1: "2222222222222222",
          5: "done",
          6: "2026-11-01",
          10: "400",
        }),
      ]),
    );
    expect(projection).toBeNull();
  });

  it("returns null when the total is not a safe integer", () => {
    const projection = buildAdminRepairs(
      makeRepairsSnapshot([
        validRepair({ 1: "1111111111111111", 5: "done", 6: "2026-10-31", 10: "9007199254740991" }),
        validRepair({ 0: "b", 1: "2222222222222222", 5: "done", 6: "2026-10-31", 10: "1" }),
      ]),
    );
    expect(projection).toBeNull();
  });

  it("returns null when an active repair has an expense", () => {
    expect(
      buildAdminRepairs(
        makeRepairsSnapshot([validRepair({ 10: "100" })]),
      ),
    ).toBeNull();
  });
});
