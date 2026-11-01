import { isRoomLetter, type RoomLetter } from "../rooms";
import type {
  AppFeedSnapshot,
  FeedBill,
  FeedLease,
  FeedPayment,
  FeedResult,
  PendingClaim,
} from "./types";

export const BILLS_HEADER = [
  "room",
  "period",
  "rent",
  "water",
  "electricity",
  "due_date",
  "paid_on",
  "claimed_on",
  "bank_last5",
] as const;

export const LEASES_HEADER = [
  "room",
  "lease_start",
  "lease_end",
  "renewal_due",
] as const;

export const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const AMOUNT_PATTERN = /^\d{1,7}$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const BANK_LAST5_PATTERN = /^\d{5}$/;

export type ParsedAmount =
  | { ok: true; value: number | null }
  | { ok: false };

export type BillRow = {
  room: RoomLetter;
  period: string;
  rent: number;
  water: number | null;
  electricity: number | null;
  dueDate: string;
  paidOn: string | null;
  claimedOn: string | null;
  bankLast5: string | null;
};

type LeaseRow = {
  room: RoomLetter;
  start: string;
  end: string;
  renewalDue: string | null;
};

type RoomErrorCounts = { bills: number; leases: number };

type Validation =
  | {
      ok: true;
      bills: BillRow[];
      leases: LeaseRow[];
      invalidRooms: Map<RoomLetter, RoomErrorCounts>;
      droppedBills: number;
      droppedLeases: number;
    }
  | { ok: false };

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isBlankRow(row: unknown[]): boolean {
  return row.every((cell) => cellText(cell) === "");
}

function padRow(row: unknown[], length: number): unknown[] {
  return Array.from({ length }, (_, index) => row[index]);
}

/**
 * Parses one padded Bills row. Returns null when any cell fails a rule for that
 * row. The claim pair must be both blank or both set; a partial pair is invalid.
 */
function parseBillRow(row: unknown[]): BillRow | null {
  const room = parseRoomCell(row[0]);
  if (!room) return null;

  const period = cellText(row[1]);
  const rent = parseWholeTwd(row[2]);
  const water = parseWholeTwd(row[3], true);
  const electricity = parseWholeTwd(row[4], true);
  const dueDate = cellText(row[5]);
  const paidOnText = cellText(row[6]);
  const claimedOnText = cellText(row[7]);
  const bankLast5Text = cellText(row[8]);

  const paidOn = paidOnText === "" ? null : paidOnText;
  const claimedOn = claimedOnText === "" ? null : claimedOnText;
  const bankLast5 = bankLast5Text === "" ? null : bankLast5Text;

  if (
    !PERIOD_PATTERN.test(period) ||
    !isRealIsoDate(dueDate) ||
    (paidOn !== null && !isRealIsoDate(paidOn))
  ) {
    return null;
  }

  if (!rent.ok || rent.value === null || !water.ok || !electricity.ok) {
    return null;
  }

  if ((claimedOn === null) !== (bankLast5 === null)) return null;
  if (claimedOn !== null && !isRealIsoDate(claimedOn)) return null;
  if (bankLast5 !== null && !BANK_LAST5_PATTERN.test(bankLast5)) return null;

  return {
    room,
    period,
    rent: rent.value,
    water: water.value,
    electricity: electricity.value,
    dueDate,
    paidOn,
    claimedOn,
    bankLast5,
  };
}

export function hasExactHeader(
  row: unknown,
  expected: readonly string[],
): boolean {
  if (!Array.isArray(row) || row.length !== expected.length) return false;
  return expected.every((header, index) => cellText(row[index]) === header);
}

export function hasExactHeaderRow(
  rows: unknown,
  expected: readonly string[],
): boolean {
  return Array.isArray(rows) && hasExactHeader(rows[0], expected);
}

export function parseRoomCell(value: unknown): RoomLetter | null {
  const room = cellText(value).toLowerCase();
  return isRoomLetter(room) ? room : null;
}

/**
 * Parses a whole New Taiwan dollar amount. `optional` allows a blank cell,
 * which means "no charge"; an explicit 0 is a real zero charge.
 */
export function parseWholeTwd(value: unknown, optional = false): ParsedAmount {
  const text = cellText(value);
  if (text === "") return optional ? { ok: true, value: null } : { ok: false };
  if (!AMOUNT_PATTERN.test(text)) return { ok: false };

  const amount = Number(text);
  if (!Number.isSafeInteger(amount)) return { ok: false };
  return { ok: true, value: amount };
}

/**
 * Checks YYYY-MM-DD against the real calendar. setUTCFullYear is used instead
 * of Date.UTC so years below 100 are not remapped to 1900 + year.
 */
export function isRealIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function markRoomInvalid(
  invalidRooms: Map<RoomLetter, RoomErrorCounts>,
  room: RoomLetter,
  tab: "bills" | "leases",
): void {
  const counts = invalidRooms.get(room) ?? { bills: 0, leases: 0 };
  counts[tab] += 1;
  invalidRooms.set(room, counts);
}

function validateSnapshot(snapshot: AppFeedSnapshot): Validation {
  if (!Array.isArray(snapshot.bills) || !Array.isArray(snapshot.leases)) {
    console.warn("[appfeed] snapshot shape invalid", { reason: "ranges" });
    return { ok: false };
  }

  if (!hasExactHeader(snapshot.bills[0], BILLS_HEADER)) {
    console.warn("[appfeed] header mismatch", { tab: "Bills" });
    return { ok: false };
  }
  if (!hasExactHeader(snapshot.leases[0], LEASES_HEADER)) {
    console.warn("[appfeed] header mismatch", { tab: "Leases" });
    return { ok: false };
  }

  const bills: BillRow[] = [];
  const leases: LeaseRow[] = [];
  const invalidRooms = new Map<RoomLetter, RoomErrorCounts>();
  const billKeys = new Set<string>();
  const leaseRooms = new Set<RoomLetter>();
  let droppedBills = 0;
  let droppedLeases = 0;

  for (let index = 1; index < snapshot.bills.length; index += 1) {
    const rawRow = snapshot.bills[index];
    if (!Array.isArray(rawRow)) {
      console.warn("[appfeed] snapshot shape invalid", { tab: "Bills", row: index + 1 });
      return { ok: false };
    }
    if (rawRow.length > BILLS_HEADER.length) {
      console.warn("[appfeed] row too wide", { tab: "Bills", row: index + 1 });
      return { ok: false };
    }
    if (isBlankRow(rawRow)) continue;

    const row = padRow(rawRow, BILLS_HEADER.length);
    const room = parseRoomCell(row[0]);
    if (!room) {
      droppedBills += 1;
      continue;
    }

    const bill = parseBillRow(row);
    if (!bill) {
      markRoomInvalid(invalidRooms, room, "bills");
      continue;
    }

    const key = `${bill.room}:${bill.period}`;
    if (billKeys.has(key)) {
      markRoomInvalid(invalidRooms, room, "bills");
      continue;
    }
    billKeys.add(key);

    bills.push(bill);
  }

  for (let index = 1; index < snapshot.leases.length; index += 1) {
    const rawRow = snapshot.leases[index];
    if (!Array.isArray(rawRow)) {
      console.warn("[appfeed] snapshot shape invalid", { tab: "Leases", row: index + 1 });
      return { ok: false };
    }
    if (rawRow.length > LEASES_HEADER.length) {
      console.warn("[appfeed] row too wide", { tab: "Leases", row: index + 1 });
      return { ok: false };
    }
    if (isBlankRow(rawRow)) continue;

    const row = padRow(rawRow, LEASES_HEADER.length);
    const room = parseRoomCell(row[0]);
    if (!room) {
      droppedLeases += 1;
      continue;
    }

    const start = cellText(row[1]);
    const end = cellText(row[2]);
    const renewalDueText = cellText(row[3]);
    const renewalDue = renewalDueText === "" ? null : renewalDueText;

    if (
      !isRealIsoDate(start) ||
      !isRealIsoDate(end) ||
      end < start ||
      (renewalDue !== null && !isRealIsoDate(renewalDue))
    ) {
      markRoomInvalid(invalidRooms, room, "leases");
      continue;
    }

    if (leaseRooms.has(room)) {
      markRoomInvalid(invalidRooms, room, "leases");
      continue;
    }
    leaseRooms.add(room);

    leases.push({ room, start, end, renewalDue });
  }

  if (droppedBills > 0 || droppedLeases > 0) {
    console.warn("[appfeed] unattributable rows ignored", {
      bills: droppedBills,
      leases: droppedLeases,
    });
  }

  return { ok: true, bills, leases, invalidRooms, droppedBills, droppedLeases };
}

function toFeedBill(bill: BillRow): FeedBill {
  return {
    period: bill.period,
    rent: bill.rent,
    water: bill.water,
    electricity: bill.electricity,
    total: bill.rent + (bill.water ?? 0) + (bill.electricity ?? 0),
    dueDate: bill.dueDate,
    claim:
      bill.claimedOn !== null && bill.bankLast5 !== null
        ? { claimedOn: bill.claimedOn, bankLast5: bill.bankLast5 }
        : null,
  };
}

function toFeedPayment(bill: BillRow & { paidOn: string }): FeedPayment {
  return {
    period: bill.period,
    amount: bill.rent + (bill.water ?? 0) + (bill.electricity ?? 0),
    receivedOn: bill.paidOn,
  };
}

/**
 * Finds one exact room and period row. Returns the sheet row number so a claim
 * can write to `Bills!H{row}:I{row}`. A paid bill is returned as-is; the caller
 * decides whether it may change.
 */
export type BillRowLookup =
  | { ok: true; rowNumber: number; bill: BillRow }
  | {
      ok: false;
      reason: "headers" | "duplicate" | "unknown-period" | "invalid";
    };

export function findBillRow(
  snapshot: AppFeedSnapshot,
  room: RoomLetter,
  period: string,
): BillRowLookup {
  if (
    !Array.isArray(snapshot.bills) ||
    !hasExactHeader(snapshot.bills[0], BILLS_HEADER)
  ) {
    return { ok: false, reason: "headers" };
  }
  if (!isRoomLetter(room) || !PERIOD_PATTERN.test(period)) {
    return { ok: false, reason: "unknown-period" };
  }

  let found: { rowNumber: number; bill: BillRow } | null = null;

  for (let index = 1; index < snapshot.bills.length; index += 1) {
    const rawRow = snapshot.bills[index];
    if (!Array.isArray(rawRow) || rawRow.length > BILLS_HEADER.length) {
      return { ok: false, reason: "invalid" };
    }
    if (isBlankRow(rawRow)) continue;

    const row = padRow(rawRow, BILLS_HEADER.length);
    if (parseRoomCell(row[0]) !== room) continue;
    if (cellText(row[1]) !== period) continue;

    const bill = parseBillRow(row);
    if (!bill) return { ok: false, reason: "invalid" };
    if (found) return { ok: false, reason: "duplicate" };
    found = { rowNumber: index + 1, bill };
  }

  return found
    ? { ok: true, rowNumber: found.rowNumber, bill: found.bill }
    : { ok: false, reason: "unknown-period" };
}

/**
 * Projects pending claims across rooms for the admin list. Only rows with both
 * claim cells and no `paid_on` are included. Returns null when the sheet shape
 * is invalid.
 */
export function buildPendingClaims(
  snapshot: AppFeedSnapshot,
): PendingClaim[] | null {
  const validation = validateSnapshot(snapshot);
  if (!validation.ok) return null;

  return validation.bills
    .filter(
      (
        bill,
      ): bill is BillRow & { claimedOn: string; bankLast5: string } =>
        bill.paidOn === null &&
        bill.claimedOn !== null &&
        bill.bankLast5 !== null,
    )
    .map((bill) => ({
      room: bill.room,
      period: bill.period,
      claimedOn: bill.claimedOn,
      bankLast5: bill.bankLast5,
    }))
    .sort(
      (a, b) =>
        a.room.localeCompare(b.room) || a.period.localeCompare(b.period),
    );
}

/**
 * Validates every row once, then projects only the requested room. Any invalid
 * row attributed to that room makes the whole room unavailable; other rooms and
 * unattributable rows are unaffected.
 */
export function buildRoomFeed(
  snapshot: AppFeedSnapshot,
  room: RoomLetter,
  fetchedAt: string,
): FeedResult {
  if (!isRoomLetter(room)) return { kind: "unavailable" };

  const validation = validateSnapshot(snapshot);
  if (!validation.ok) return { kind: "unavailable" };

  const errors = validation.invalidRooms.get(room);
  if (errors) {
    console.warn("[appfeed] room unavailable", {
      room,
      invalidBillsRows: errors.bills,
      invalidLeasesRows: errors.leases,
    });
    return { kind: "unavailable" };
  }

  const roomBills = validation.bills.filter((bill) => bill.room === room);

  const openBills = roomBills
    .filter((bill) => bill.paidOn === null)
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) || a.period.localeCompare(b.period),
    )
    .map(toFeedBill);

  const payments = roomBills
    .filter((bill): bill is BillRow & { paidOn: string } => bill.paidOn !== null)
    .sort(
      (a, b) =>
        b.paidOn.localeCompare(a.paidOn) || b.period.localeCompare(a.period),
    )
    .slice(0, 12)
    .map(toFeedPayment);

  const leaseRow = validation.leases.find((lease) => lease.room === room);
  const lease: FeedLease | null = leaseRow
    ? {
        start: leaseRow.start,
        end: leaseRow.end,
        renewalDue: leaseRow.renewalDue,
      }
    : null;

  return {
    kind: "ok",
    feed: { room, openBills, payments, lease, fetchedAt },
  };
}
