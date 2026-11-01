import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isRenewalReminderDue } from "@/lib/appfeed/dates";
import {
  BILLS_HEADER,
  LEASES_HEADER,
  buildLeaseRenewals,
} from "@/lib/appfeed/validate";
import { listLeaseRenewals } from "@/lib/appfeed/renewal";
import type { AppFeedSnapshot } from "@/lib/appfeed/types";

const mocks = vi.hoisted(() => ({
  isAdminSession: vi.fn(),
  fetchAppFeedSnapshot: vi.fn(),
  todayInTaipei: vi.fn(),
}));

vi.mock("@/lib/session-cookies", () => ({
  isAdminSession: mocks.isAdminSession,
}));

vi.mock("@/lib/appfeed/google", () => ({
  fetchAppFeedSnapshot: mocks.fetchAppFeedSnapshot,
}));

vi.mock("@/lib/appfeed/dates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/appfeed/dates")>();
  return { ...actual, todayInTaipei: mocks.todayInTaipei };
});

const TODAY = "2026-12-31";

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
  const row: unknown[] = Array.from({ length: BILLS_HEADER.length }, () => "");
  row[0] = "a";
  row[1] = "2026-10";
  row[2] = "750";
  row[5] = "2026-11-01";
  for (const [index, value] of Object.entries(overrides)) {
    row[Number(index)] = value;
  }
  return row;
}

function validLease(overrides: Partial<Record<number, unknown>> = {}): unknown[] {
  const row: unknown[] = ["a", "2026-01-01", "2027-03-01", ""];
  for (const [index, value] of Object.entries(overrides)) {
    row[Number(index)] = value;
  }
  return row;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAdminSession.mockResolvedValue(true);
  mocks.todayInTaipei.mockReturnValue(TODAY);
  mocks.fetchAppFeedSnapshot.mockResolvedValue({
    kind: "ok",
    snapshot: makeSnapshot(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildLeaseRenewals", () => {
  it("returns only leases inside the window, sorted by end then room", () => {
    const snapshot = makeSnapshot(
      [],
      [
        validLease({ 0: "a", 2: "2027-03-01" }),
        validLease({ 0: "d", 2: "2027-01-15" }),
        validLease({ 0: "b", 2: "2027-01-15" }),
      ],
    );

    expect(buildLeaseRenewals(snapshot, TODAY)).toEqual([
      { room: "b", end: "2027-01-15" },
      { room: "d", end: "2027-01-15" },
      { room: "a", end: "2027-03-01" },
    ]);
  });

  it("excludes a lease 61 days before its end and one already past", () => {
    const snapshot = makeSnapshot(
      [],
      [
        validLease({ 0: "a", 2: "2027-03-02" }),
        validLease({ 0: "b", 2: "2026-12-30" }),
      ],
    );

    expect(buildLeaseRenewals(snapshot, TODAY)).toEqual([]);
  });

  it("keeps a reminder when renewal_due is set", () => {
    const snapshot = makeSnapshot(
      [],
      [validLease({ 0: "a", 2: "2027-01-15", 3: "2026-12-01" })],
    );

    expect(buildLeaseRenewals(snapshot, TODAY)).toEqual([
      { room: "a", end: "2027-01-15" },
    ]);
  });

  it("returns an empty list when no lease row exists", () => {
    expect(buildLeaseRenewals(makeSnapshot(), TODAY)).toEqual([]);
  });

  it("projects only the room and lease end", () => {
    const [renewal] = buildLeaseRenewals(
      makeSnapshot([], [validLease({ 0: "a", 2: "2027-01-15" })]),
      TODAY,
    ) ?? [];

    expect(renewal).toEqual({ room: "a", end: "2027-01-15" });
    expect(Object.keys(renewal)).toEqual(["room", "end"]);
  });

  it("returns null when an attributed lease row is invalid", () => {
    const snapshot = makeSnapshot(
      [],
      [validLease({ 0: "a", 2: "not-a-date" })],
    );

    expect(buildLeaseRenewals(snapshot, TODAY)).toBeNull();
  });

  it("keeps renewals when a separate bill row is invalid", () => {
    const snapshot = makeSnapshot(
      [validBill({ 1: "bad-period" })],
      [validLease({ 0: "a", 2: "2027-01-15" })],
    );

    expect(buildLeaseRenewals(snapshot, TODAY)).toEqual([
      { room: "a", end: "2027-01-15" },
    ]);
  });

  it("returns null when the snapshot shape is invalid", () => {
    expect(
      buildLeaseRenewals({ bills: [], leases: [] }, TODAY),
    ).toBeNull();
  });
});

describe("listLeaseRenewals", () => {
  it("denies a tenant or anonymous caller before reading the sheet", async () => {
    mocks.isAdminSession.mockResolvedValue(false);

    await expect(listLeaseRenewals()).resolves.toEqual({ kind: "denied" });
    expect(mocks.fetchAppFeedSnapshot).not.toHaveBeenCalled();
  });

  it("returns unavailable when the snapshot read fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "unavailable",
      reason: "quota",
      transient: true,
    });

    await expect(listLeaseRenewals()).resolves.toEqual({
      kind: "unavailable",
    });
    expect(warn).toHaveBeenCalledWith("[renewal] list unavailable", {
      reason: "quota",
    });
  });

  it("returns the sorted renewals and reads once", async () => {
    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: makeSnapshot(
        [],
        [
          validLease({ 0: "a", 2: "2027-03-01" }),
          validLease({ 0: "d", 2: "2027-01-15" }),
          validLease({ 0: "b", 2: "2027-01-15" }),
        ],
      ),
    });

    await expect(listLeaseRenewals()).resolves.toEqual({
      kind: "ok",
      renewals: [
        { room: "b", end: "2027-01-15" },
        { room: "d", end: "2027-01-15" },
        { room: "a", end: "2027-03-01" },
      ],
    });
    expect(mocks.fetchAppFeedSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.todayInTaipei).toHaveBeenCalledTimes(1);
  });

  it("returns unavailable when an attributed lease row is invalid", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: makeSnapshot(
        [],
        [
          validLease({ 0: "a", 2: "not-a-date" }),
          validLease({
            0: "b",
            1: "2026-06-01",
            2: "2027-02-01",
          }),
        ],
      ),
    });

    await expect(listLeaseRenewals()).resolves.toEqual({
      kind: "unavailable",
    });
    const messages = warn.mock.calls.map(([message]) => message);
    expect(messages).toContain("[appfeed] lease renewals unavailable");
    expect(messages).toContain("[renewal] list unavailable");
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain("2027-");
    expect(logged).not.toContain("2026-");
    expect(logged).not.toContain("not-a-date");
  });

  it("keeps a renewal when a separate bill row is invalid", async () => {
    mocks.fetchAppFeedSnapshot.mockResolvedValue({
      kind: "ok",
      snapshot: makeSnapshot(
        [validBill({ 1: "bad-period" })],
        [validLease({ 0: "a", 2: "2027-01-15" })],
      ),
    });

    await expect(listLeaseRenewals()).resolves.toEqual({
      kind: "ok",
      renewals: [{ room: "a", end: "2027-01-15" }],
    });
  });
});

describe("isRenewalReminderDue", () => {
  it("is due exactly 60 days before the lease end", () => {
    expect(isRenewalReminderDue("2027-03-01", "2026-12-31")).toBe(true);
  });

  it("is not due 61 days before the lease end", () => {
    expect(isRenewalReminderDue("2027-03-01", "2026-12-30")).toBe(false);
  });

  it("is due on the lease end date", () => {
    expect(isRenewalReminderDue("2027-03-01", "2027-03-01")).toBe(true);
  });

  it("is not due one day after the lease end", () => {
    expect(isRenewalReminderDue("2027-03-01", "2027-03-02")).toBe(false);
  });

  it("counts calendar days across a leap day", () => {
    expect(isRenewalReminderDue("2028-02-29", "2027-12-31")).toBe(true);
  });

  it("does not remap years below 100", () => {
    expect(isRenewalReminderDue("0099-03-01", "0098-12-31")).toBe(true);
    expect(isRenewalReminderDue("0099-03-01", "0098-12-30")).toBe(false);
  });
});
