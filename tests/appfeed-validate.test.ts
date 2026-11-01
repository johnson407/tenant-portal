import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AMOUNT_PATTERN,
  BILLS_HEADER,
  DATE_PATTERN,
  LEASES_HEADER,
  PERIOD_PATTERN,
  buildRoomFeed,
  findBillRow,
  isRealIsoDate,
  parseRoomCell,
  parseWholeTwd,
} from "@/lib/appfeed/validate";
import type { AppFeedSnapshot } from "@/lib/appfeed/types";
import type { RoomLetter } from "@/lib/rooms";

const FETCHED_AT = "2026-10-31T04:00:00.000Z";

function makeSnapshot(
  bills: unknown[][] = [],
  leases: unknown[][] = [],
): AppFeedSnapshot {
  return {
    bills: [[...BILLS_HEADER], ...bills],
    leases: [[...LEASES_HEADER], ...leases],
  };
}

function validBill(overrides: Partial<Record<number, unknown>> = {}): unknown[] {
  const row: unknown[] = [
    "a",
    "2026-10",
    "750",
    "",
    "",
    "2026-11-01",
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
  ];
  for (const [index, value] of Object.entries(overrides)) {
    row[Number(index)] = value;
  }
  return row;
}

function validLease(overrides: Partial<Record<number, unknown>> = {}): unknown[] {
  const row: unknown[] = ["a", "2026-01-01", "2026-12-31", "2026-11-30"];
  for (const [index, value] of Object.entries(overrides)) {
    row[Number(index)] = value;
  }
  return row;
}

function feedFor(snapshot: AppFeedSnapshot, room: RoomLetter = "a") {
  return buildRoomFeed(snapshot, room, FETCHED_AT);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AppFeed constants", () => {
  it("exports the exact header rows and patterns", () => {
    expect([...BILLS_HEADER]).toEqual([
      "room",
      "period",
      "rent",
      "water",
      "electricity",
      "due_date",
      "paid_on",
      "claimed_on",
      "bank_last5",
      "water_start",
      "water_end",
      "water_rate",
      "electricity_start",
      "electricity_end",
      "electricity_rate",
      "confirmed_on",
      "confirm_note",
    ]);
    expect([...LEASES_HEADER]).toEqual([
      "room",
      "lease_start",
      "lease_end",
      "renewal_due",
    ]);
    expect(PERIOD_PATTERN.source).toBe("^\\d{4}-(0[1-9]|1[0-2])$");
    expect(AMOUNT_PATTERN.source).toBe("^\\d{1,7}$");
    expect(DATE_PATTERN.source).toBe("^\\d{4}-\\d{2}-\\d{2}$");
  });
});

describe("cell parsers", () => {
  it("trims, uppercases, and only accepts rooms A-E", () => {
    expect(parseRoomCell(" a ")).toBe("a");
    expect(parseRoomCell("E")).toBe("e");
    expect(parseRoomCell("f")).toBeNull();
    expect(parseRoomCell("")).toBeNull();
    expect(parseRoomCell("jane@example.com")).toBeNull();
    expect(parseRoomCell(12)).toBeNull();
  });

  it("accepts whole amounts from 0 to 9,999,999 only", () => {
    expect(parseWholeTwd("750")).toEqual({ ok: true, value: 750 });
    expect(parseWholeTwd(" 0 ")).toEqual({ ok: true, value: 0 });
    expect(parseWholeTwd("9999999")).toEqual({ ok: true, value: 9999999 });
    expect(parseWholeTwd(750)).toEqual({ ok: true, value: 750 });
    expect(parseWholeTwd("")).toEqual({ ok: false });
    expect(parseWholeTwd("", true)).toEqual({ ok: true, value: null });
    expect(parseWholeTwd("10000000")).toEqual({ ok: false });
  });

  it.each(["$1,000", "1,000", "-1", "1.5", "#DIV/0!", "NT$750", "７５０", "1e3"])(
    "rejects formatted or invalid amount %s",
    (value) => {
      expect(parseWholeTwd(value)).toEqual({ ok: false });
    },
  );

  it("checks real calendar dates, including leap days", () => {
    expect(isRealIsoDate("2024-02-29")).toBe(true);
    expect(isRealIsoDate("2026-02-28")).toBe(true);
    expect(isRealIsoDate("2026-02-30")).toBe(false);
    expect(isRealIsoDate("2026-13-01")).toBe(false);
    expect(isRealIsoDate("2026-04-31")).toBe(false);
    expect(isRealIsoDate("2026-00-10")).toBe(false);
    expect(isRealIsoDate("2026-1-01")).toBe(false);
    expect(isRealIsoDate("2026/01/01")).toBe(false);
    expect(isRealIsoDate("46000")).toBe(false);
  });
});

describe("Bills validation", () => {
  it("projects open bills with totals and sorts by due date then period", () => {
    const result = feedFor(
      makeSnapshot([
        validBill({ 1: "2026-12", 5: "2026-12-15" }),
        validBill({ 1: "2026-11", 5: "2026-11-01", 3: "100", 4: "50" }),
        validBill({ 1: "2026-10", 5: "2026-11-01", 3: "0", 4: "0" }),
      ]),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.openBills.map((bill) => bill.period)).toEqual([
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
    expect(result.feed.openBills[1]).toEqual({
      period: "2026-11",
      rent: 750,
      water: 100,
      electricity: 50,
      total: 900,
      dueDate: "2026-11-01",
      claim: null,
      waterBreakdown: null,
      electricityBreakdown: null,
    });
  });

  it("treats blank utilities as no charge and 0 as a real zero", () => {
    const result = feedFor(
      makeSnapshot([validBill({ 3: "", 4: "0" })]),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.openBills[0]).toMatchObject({
      water: null,
      electricity: 0,
      total: 750,
    });
  });

  it("projects a complete water meter group and its units", () => {
    const result = feedFor(
      makeSnapshot([
        validBill({ 3: "100", 9: "1200", 10: "1220", 11: "5" }),
      ]),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.openBills[0].waterBreakdown).toEqual({
      start: 1200,
      end: 1220,
      units: 20,
      rate: 5,
    });
    expect(result.feed.openBills[0].electricityBreakdown).toBeNull();
  });

  it("projects a complete electricity group with a fractional rate", () => {
    const result = feedFor(
      makeSnapshot([
        validBill({ 4: "110", 12: "3000", 13: "3020", 14: "5.5" }),
      ]),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.openBills[0].electricityBreakdown).toEqual({
      start: 3000,
      end: 3020,
      units: 20,
      rate: 5.5,
    });
  });

  it("accepts an exact product and a zero-unit group", () => {
    const result = feedFor(
      makeSnapshot([
        validBill({ 3: "0", 9: "1200", 10: "1200", 11: "5" }),
        validBill({
          1: "2026-11",
          3: "145",
          9: "100",
          10: "120",
          11: "7.25",
        }),
      ]),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.openBills[0].waterBreakdown).toEqual({
      start: 1200,
      end: 1200,
      units: 0,
      rate: 5,
    });
    expect(result.feed.openBills[1].waterBreakdown).toEqual({
      start: 100,
      end: 120,
      units: 20,
      rate: 7.25,
    });
  });

  it("accepts a half-up rounded product", () => {
    // 33 units x NT$2.6253 = 86.6349, rounded half up to NT$87.
    const result = feedFor(
      makeSnapshot([validBill({ 3: "87", 9: "100", 10: "133", 11: "2.6253" })]),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.openBills[0].waterBreakdown).toEqual({
      start: 100,
      end: 133,
      units: 33,
      rate: 2.6253,
    });
  });

  it("rounds an exact half up to the next NT$", () => {
    const result = feedFor(
      makeSnapshot([validBill({ 3: "3", 9: "0", 10: "5", 11: "0.50" })]),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.openBills[0].waterBreakdown).toEqual({
      start: 0,
      end: 5,
      units: 5,
      rate: 0.5,
    });
  });

  it.each([
    [
      "a half rounded down to the wrong amount",
      { 3: "2", 9: "0", 10: "5", 11: "0.50" },
    ],
    ["a partial water group", { 3: "100", 9: "1200", 10: "1220" }],
    ["a partial electricity group", { 4: "100", 12: "3000", 13: "3020" }],
    ["a group with a blank amount", { 9: "1200", 10: "1220", 11: "5" }],
    ["a zero rate", { 3: "0", 9: "1200", 10: "1220", 11: "0" }],
    ["an end below the start", { 3: "100", 9: "1220", 10: "1200", 11: "5" }],
    ["a fractional reading", { 3: "100", 9: "1200.5", 10: "1220", 11: "5" }],
    ["a rate with five decimals", { 3: "100", 9: "1200", 10: "1220", 11: "5.00001" }],
    ["a rate above four integer digits", { 3: "100", 9: "1200", 10: "1220", 11: "10000" }],
    ["a one-NT$ mismatch", { 3: "100", 9: "1200", 10: "1220", 11: "5.5" }],
  ])("fails the whole room closed for %s", (_label, overrides) => {
    const result = feedFor(makeSnapshot([validBill(overrides)]));

    expect(result).toEqual({ kind: "unavailable" });
  });

  it("projects a pending claim on an open bill", () => {
    const result = feedFor(
      makeSnapshot([validBill({ 7: "2026-10-28", 8: "01234" })]),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.openBills[0].claim).toEqual({
      claimedOn: "2026-10-28",
      bankLast5: "01234",
    });
  });

  it("keeps a confirmed bill out of open bills even with leftover claim cells", () => {
    const result = feedFor(
      makeSnapshot([
        validBill({ 6: "2026-10-30", 7: "2026-10-28", 8: "01234" }),
      ]),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.openBills).toHaveLength(0);
    expect(result.feed.payments).toHaveLength(1);
    expect(result.feed.payments[0].period).toBe("2026-10");
  });

  it.each([
    ["only the claimed date", { 7: "2026-10-28" }],
    ["only the bank suffix", { 8: "01234" }],
    ["an impossible claimed date", { 7: "2026-02-30", 8: "01234" }],
    ["a four-digit suffix", { 7: "2026-10-28", 8: "0123" }],
    ["a six-digit suffix", { 7: "2026-10-28", 8: "012345" }],
    ["a suffix with letters", { 7: "2026-10-28", 8: "0123a" }],
  ])("fails the whole room closed for %s", (_label, overrides) => {
    const result = feedFor(makeSnapshot([validBill(overrides)]));

    expect(result).toEqual({ kind: "unavailable" });
  });

  it("accepts a five-digit suffix with a leading zero", () => {
    const result = feedFor(
      makeSnapshot([validBill({ 7: "2026-10-28", 8: "00042" })]),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.openBills[0].claim?.bankLast5).toBe("00042");
  });

  it("accepts a confirmation date with a claim and a blank paid date", () => {
    const result = feedFor(
      makeSnapshot([
        validBill({
          7: "2026-10-28",
          8: "01234",
          15: "2026-11-01",
        }),
      ]),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.openBills[0].claim?.claimedOn).toBe("2026-10-28");
  });

  it("accepts a confirmation date and note after payment", () => {
    const result = feedFor(
      makeSnapshot([
        validBill({
          6: "2026-10-30",
          7: "2026-10-28",
          8: "01234",
          15: "2026-11-01",
          16: "  Received  ",
        }),
      ]),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.payments).toHaveLength(1);
  });

  it("projects payments newest first and keeps the latest 12", () => {
    const rows = Array.from({ length: 13 }, (_, index) => {
      const year = 2025 + Math.floor(index / 12);
      const month = String((index % 12) + 1).padStart(2, "0");
      return validBill({
        1: `${year}-${month}`,
        5: "2026-01-01",
        6: `${year}-${month}-05`,
      });
    });

    const result = feedFor(makeSnapshot(rows));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.openBills).toHaveLength(0);
    expect(result.feed.payments).toHaveLength(12);
    expect(result.feed.payments[0].receivedOn).toBe("2026-01-05");
    expect(result.feed.payments[0].period).toBe("2026-01");
  });

  it("sorts equal received dates by period descending", () => {
    const result = feedFor(
      makeSnapshot([
        validBill({ 1: "2026-01", 6: "2026-02-01" }),
        validBill({ 1: "2026-02", 6: "2026-02-01" }),
      ]),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.payments.map((payment) => payment.period)).toEqual([
      "2026-02",
      "2026-01",
    ]);
  });

  it("ignores fully empty rows", () => {
    const result = feedFor(
      makeSnapshot([
        ["", " ", null, undefined, "", "", ""],
        validBill(),
      ]),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.openBills).toHaveLength(1);
  });

  it("accepts lowercase and padded room cells", () => {
    const result = feedFor(makeSnapshot([validBill({ 0: " b " })]), "b");

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.room).toBe("b");
    expect(result.feed.openBills).toHaveLength(1);
  });

  it.each([
    ["period", { 1: "2026-13" }],
    ["rent", { 2: "$1,000" }],
    ["water", { 3: "1,000" }],
    ["electricity", { 4: "-1" }],
    ["due_date", { 5: "2026-02-30" }],
    ["paid_on", { 6: "2026-04-31" }],
    ["claimed_on", { 7: "2026-04-31", 8: "01234" }],
    ["bank_last5", { 7: "2026-10-28", 8: "0123x" }],
    ["confirmed_on", { 7: "2026-10-28", 8: "01234", 15: "2026-02-30" }],
    ["confirm_note without a confirmation date", { 7: "2026-10-28", 8: "01234", 16: "Received" }],
    ["confirmation without a claim", { 15: "2026-11-01" }],
    ["confirmation before the claim", { 7: "2026-10-28", 8: "01234", 15: "2026-10-27" }],
    ["confirmation before payment", { 6: "2026-10-30", 7: "2026-10-28", 8: "01234", 15: "2026-10-29" }],
    ["confirm_note with an email", { 7: "2026-10-28", 8: "01234", 15: "2026-11-01", 16: "jane@example.com" }],
  ])("fails the whole room closed for a bad %s", (_column, overrides) => {
    const result = feedFor(makeSnapshot([validBill(overrides)]));
    expect(result).toEqual({ kind: "unavailable" });
  });

  it("accepts header cells with surrounding whitespace", () => {
    const snapshot: AppFeedSnapshot = {
      bills: [BILLS_HEADER.map((header) => ` ${header} `)],
      leases: [LEASES_HEADER.map((header) => ` ${header} `)],
    };

    expect(feedFor(snapshot).kind).toBe("ok");
  });

  it("rejects duplicate (room, period) rows", () => {
    const result = feedFor(
      makeSnapshot([validBill(), validBill({ 0: "A", 2: "800" })]),
    );

    expect(result).toEqual({ kind: "unavailable" });
  });

  it("fails only the affected room and leaves other rooms available", () => {
    const snapshot = makeSnapshot([
      validBill({ 0: "a", 2: "$1,000" }),
      validBill({ 0: "b", 2: "800" }),
    ]);

    expect(feedFor(snapshot, "a")).toEqual({ kind: "unavailable" });
    const roomB = feedFor(snapshot, "b");
    expect(roomB.kind).toBe("ok");
    if (roomB.kind !== "ok") return;
    expect(roomB.feed.openBills[0].rent).toBe(800);
  });
});

describe("Leases validation", () => {
  it("projects a lease and turns a blank renewal into null", () => {
    const result = feedFor(makeSnapshot([], [validLease({ 3: "" })]));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.lease).toEqual({
      start: "2026-01-01",
      end: "2026-12-31",
      renewalDue: null,
    });
  });

  it("returns a null lease when the room has no row", () => {
    const result = feedFor(makeSnapshot([], [validLease({ 0: "b" })]));

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.lease).toBeNull();
  });

  it("rejects a lease that ends before it starts", () => {
    const result = feedFor(
      makeSnapshot([], [validLease({ 1: "2026-12-31", 2: "2026-01-01" })]),
    );

    expect(result).toEqual({ kind: "unavailable" });
  });

  it("rejects duplicate lease rows for one room", () => {
    const result = feedFor(makeSnapshot([], [validLease(), validLease()]));

    expect(result).toEqual({ kind: "unavailable" });
  });

  it("allows a lease that starts and ends on the same day", () => {
    const result = feedFor(
      makeSnapshot([], [validLease({ 1: "2026-06-01", 2: "2026-06-01" })]),
    );

    expect(result.kind).toBe("ok");
  });
});

describe("structural failures", () => {
  it.each([
    ["Bills header renamed", { bills: [["room", "period", "rent", "water", "electricity", "due", "paid_on", "claimed_on", "bank_last5"]], leases: [[...LEASES_HEADER]] }],
    ["Bills header reordered", { bills: [["period", "room", "rent", "water", "electricity", "due_date", "paid_on", "claimed_on", "bank_last5"]], leases: [[...LEASES_HEADER]] }],
    ["Leases header missing", { bills: [[...BILLS_HEADER]], leases: [] }],
    ["row wider than the range", { bills: [[...BILLS_HEADER], [...validBill(), "extra"]], leases: [[...LEASES_HEADER]] }],
  ])("makes the whole feed unavailable for %s", (_label, snapshot) => {
    expect(feedFor(snapshot as AppFeedSnapshot)).toEqual({
      kind: "unavailable",
    });
  });
});

describe("unattributable and PII rows", () => {
  it("drops rows with an invalid room and counts them", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const snapshot = makeSnapshot([
      validBill({ 0: "z", 2: "1234567" }),
      validBill({ 0: "a", 2: "750" }),
    ]);

    const result = feedFor(snapshot, "a");
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.feed.openBills[0].rent).toBe(750);
    expect(warn).toHaveBeenCalledWith("[appfeed] unattributable rows ignored", {
      bills: 1,
      leases: 0,
    });
  });

  const PII_VALUES = ["jane@example.com", "0912345678", "A123456789"];

  it.each(PII_VALUES)(
    "never projects PII %s from any Bills column",
    (pii) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      for (let column = 0; column < BILLS_HEADER.length; column += 1) {
        const snapshot = makeSnapshot([
          validBill({ 0: "b", 2: "800" }),
          validBill({ 0: "a", [column]: pii } as Partial<Record<number, unknown>>),
        ]);
        const serialized = (["a", "b"] as RoomLetter[])
          .map((room) => JSON.stringify(feedFor(snapshot, room)))
          .join("");
        expect(serialized).not.toContain(pii);
        expect(JSON.stringify(warn.mock.calls)).not.toContain(pii);
      }
    },
  );

  it.each(PII_VALUES)(
    "never projects PII %s from any Leases column",
    (pii) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      for (let column = 0; column < LEASES_HEADER.length; column += 1) {
        const snapshot = makeSnapshot(
          [],
          [
            validLease({ 0: "b" }),
            validLease({ 0: "a", [column]: pii } as Partial<Record<number, unknown>>),
          ],
        );
        const serialized = (["a", "b"] as RoomLetter[])
          .map((room) => JSON.stringify(feedFor(snapshot, room)))
          .join("");
        expect(serialized).not.toContain(pii);
        expect(JSON.stringify(warn.mock.calls)).not.toContain(pii);
      }
    },
  );

  it("does not log cell contents when a room row is rejected", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = feedFor(
      makeSnapshot([validBill({ 1: "jane@example.com" })]),
    );

    expect(result).toEqual({ kind: "unavailable" });
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain("jane@example.com");
    expect(logged).not.toContain("2026-11-01");
    expect(warn).toHaveBeenCalledWith("[appfeed] room unavailable", {
      invalidBillsRows: 1,
      invalidLeasesRows: 0,
    });
  });

  it("rejects an invalid runtime room", () => {
    expect(feedFor(makeSnapshot(), "f" as RoomLetter)).toEqual({
      kind: "unavailable",
    });
  });
});

describe("findBillRow", () => {
  it("returns the sheet row number, not the snapshot index", () => {
    const snapshot = makeSnapshot([
      validBill({ 0: "b", 1: "2026-10", 2: "800" }),
      validBill({ 0: "a", 1: "2026-10", 2: "750" }),
      validBill({ 0: "a", 1: "2026-11", 2: "760" }),
    ]);

    const lookup = findBillRow(snapshot, "a", "2026-11");

    expect(lookup).toMatchObject({
      ok: true,
      rowNumber: 4,
      bill: { room: "a", period: "2026-11", rent: 760 },
    });
  });

  it("returns a paid bill so the caller can reject the change", () => {
    const lookup = findBillRow(
      makeSnapshot([validBill({ 6: "2026-10-05" })]),
      "a",
      "2026-10",
    );

    expect(lookup.ok).toBe(true);
    if (!lookup.ok) return;
    expect(lookup.bill.paidOn).toBe("2026-10-05");
  });

  it.each([
    ["an unknown period", makeSnapshot([validBill()]), "2026-12", "unknown-period"],
    [
      "a duplicate row",
      makeSnapshot([validBill(), validBill({ 2: "800" })]),
      "2026-10",
      "duplicate",
    ],
    [
      "a row with a valid room but invalid column",
      makeSnapshot([validBill({ 8: "1234" })]),
      "2026-10",
      "invalid",
    ],
  ])("returns a typed reason for %s", (_label, snapshot, period, reason) => {
    expect(findBillRow(snapshot, "a", period)).toEqual({ ok: false, reason });
  });

  it("returns a header reason when the Bills header is wrong", () => {
    const snapshot: AppFeedSnapshot = {
      bills: [["room", "period", "rent", "water", "electricity", "due_date", "paid_on"]],
      leases: [[...LEASES_HEADER]],
    };

    expect(findBillRow(snapshot, "a", "2026-10")).toEqual({
      ok: false,
      reason: "headers",
    });
  });
});
