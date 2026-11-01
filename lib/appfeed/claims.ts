import "server-only";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { isRoomLetter, type RoomLetter } from "../rooms";
import { clientIpFromHeaders } from "../client-ip";
import { isAdminSession } from "../session-cookies";
import {
  CLAIM_CONFIRM_RATE_BUCKET,
  CLAIM_RATE_BUCKET,
  consumeAttempt,
} from "../rate-limit";
import type { PendingClaim } from "./types";
import { todayInTaipei } from "./dates";
import { acquireClaimConfirmLock } from "./claim-lock";
import {
  fetchAppFeedSnapshot,
  writeBillPaidOn,
  writeClaimCells,
  writeClaimConfirmation,
} from "./google";
import {
  BANK_LAST5_PATTERN,
  PERIOD_PATTERN,
  buildPendingClaims,
  findBillRow,
  isRealIsoDate,
  isValidOptionalNote,
} from "./validate";

export type ClaimInput = {
  claimedOn: unknown;
  bankLast5: unknown;
};

export type ParsedClaimInput =
  | { ok: true; value: { claimedOn: string; bankLast5: string } }
  | { ok: false; reason: "date" | "suffix" };

export type ClaimSubmitResult =
  | { kind: "ok" }
  | { kind: "error"; reason: "date" | "suffix" | "unavailable" };

export type PendingClaimsResult =
  | { kind: "ok"; claims: PendingClaim[] }
  | { kind: "denied" }
  | { kind: "unavailable" };

export type ConfirmClaimResult =
  | { kind: "ok" }
  | { kind: "denied" }
  | {
      kind: "error";
      reason:
        | "date"
        | "note"
        | "not-found"
        | "paid"
        | "unavailable"
        | "rate";
    };

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Validates a tenant claim. The date must be real and not later than today in
 * Asia/Taipei. The suffix must be exactly five digits after trimming.
 */
export function parseClaimInput(
  input: ClaimInput,
  now: Date = new Date(),
): ParsedClaimInput {
  const claimedOn = text(input.claimedOn);
  const bankLast5 = text(input.bankLast5);

  if (!isRealIsoDate(claimedOn) || claimedOn > todayInTaipei(now)) {
    return { ok: false, reason: "date" };
  }
  if (!BANK_LAST5_PATTERN.test(bankLast5)) {
    return { ok: false, reason: "suffix" };
  }

  return { ok: true, value: { claimedOn, bankLast5 } };
}

async function limiterKeys(room: RoomLetter): Promise<string[]> {
  const headerList = await headers();
  return [`ip:${clientIpFromHeaders(headerList)}`, `room:${room}`];
}

async function confirmationLimiterKeys(): Promise<string[]> {
  const headerList = await headers();
  return [`ip:${clientIpFromHeaders(headerList)}`];
}

/**
 * Stores a tenant payment claim in the two claim columns of one open bill.
 * Reads fresh so a stale cache cannot overwrite a landlord confirmation.
 */
export async function submitClaim(
  room: RoomLetter,
  period: string,
  input: ClaimInput,
): Promise<ClaimSubmitResult> {
  if (!isRoomLetter(room)) return { kind: "error", reason: "unavailable" };

  // Keep unvalidated input out of the logs.
  const safePeriod = PERIOD_PATTERN.test(period) ? period : "";

  const parsed = parseClaimInput(input);
  if (!parsed.ok) return { kind: "error", reason: parsed.reason };

  let allowed = false;
  try {
    const decision = await consumeAttempt(
      CLAIM_RATE_BUCKET,
      await limiterKeys(room),
    );
    allowed = decision.allowed;
  } catch {
    console.warn("[claims] limiter unavailable", { room, period: safePeriod });
    return { kind: "error", reason: "unavailable" };
  }
  if (!allowed) {
    console.warn("[claims] claim not saved", {
      room,
      period: safePeriod,
      reason: "rate-limit",
    });
    return { kind: "error", reason: "unavailable" };
  }

  const snapshot = await fetchAppFeedSnapshot();
  if (snapshot.kind !== "ok") {
    console.warn("[claims] claim not saved", {
      room,
      period: safePeriod,
      reason: "read",
    });
    return { kind: "error", reason: "unavailable" };
  }

  const lookup = findBillRow(snapshot.snapshot, room, period);
  if (
    !lookup.ok ||
    lookup.bill.paidOn !== null ||
    lookup.bill.confirmedOn !== null
  ) {
    console.warn("[claims] claim not saved", {
      room,
      period: safePeriod,
      reason: "lookup",
    });
    return { kind: "error", reason: "unavailable" };
  }

  const written = await writeClaimCells(lookup.rowNumber, parsed.value);
  if (written.kind !== "ok") {
    console.warn("[claims] claim not saved", {
      room,
      period: safePeriod,
      reason: "write",
    });
    return { kind: "error", reason: "unavailable" };
  }

  // Expire the room entry immediately so the next render shows the claim.
  revalidateTag(`appfeed:room:${room}`, { expire: 0 });
  return { kind: "ok" };
}

/**
 * Confirms one pending claim. Writes the confirmation cells first and the
 * paid date second, so a failed second write keeps the claim in the queue.
 * Reads fresh before the write and verifies the row after it.
 */
export async function confirmClaim(
  room: RoomLetter,
  period: string,
  paidOnInput: unknown,
  noteInput: unknown = "",
): Promise<ConfirmClaimResult> {
  if (!(await isAdminSession())) return { kind: "denied" };

  if (!isRoomLetter(room) || !PERIOD_PATTERN.test(period)) {
    return { kind: "error", reason: "not-found" };
  }

  const safePeriod = period;
  if (typeof paidOnInput !== "string") {
    return { kind: "error", reason: "date" };
  }
  const paidOn = text(paidOnInput);
  if (!isRealIsoDate(paidOn) || paidOn > todayInTaipei()) {
    return { kind: "error", reason: "date" };
  }

  if (typeof noteInput !== "string" || !isValidOptionalNote(noteInput)) {
    return { kind: "error", reason: "note" };
  }
  const note = noteInput.trim();

  let allowed = false;
  try {
    const decision = await consumeAttempt(
      CLAIM_CONFIRM_RATE_BUCKET,
      await confirmationLimiterKeys(),
    );
    allowed = decision.allowed;
  } catch {
    console.warn("[claims] confirmation not saved", {
      room,
      period: safePeriod,
      reason: "limiter",
    });
    return { kind: "error", reason: "unavailable" };
  }
  if (!allowed) {
    console.warn("[claims] confirmation not saved", {
      room,
      period: safePeriod,
      reason: "rate-limit",
    });
    return { kind: "error", reason: "rate" };
  }

  let release: (() => Promise<void>) | null = null;
  try {
    release = await acquireClaimConfirmLock(room, period);
  } catch {
    console.warn("[claims] confirmation not saved", {
      room,
      period: safePeriod,
      reason: "lock",
    });
    return { kind: "error", reason: "unavailable" };
  }
  if (release === null) {
    console.warn("[claims] confirmation not saved", {
      room,
      period: safePeriod,
      reason: "locked",
    });
    return { kind: "error", reason: "unavailable" };
  }

  try {
    const snapshot = await fetchAppFeedSnapshot();
    if (snapshot.kind !== "ok") {
      console.warn("[claims] confirmation not saved", {
        room,
        period: safePeriod,
        reason: snapshot.reason,
      });
      return { kind: "error", reason: "unavailable" };
    }

    const lookup = findBillRow(snapshot.snapshot, room, period);
    if (!lookup.ok) {
      return { kind: "error", reason: "not-found" };
    }
    if (lookup.bill.paidOn !== null) {
      return { kind: "error", reason: "paid" };
    }
    if (lookup.bill.claimedOn === null || lookup.bill.bankLast5 === null) {
      return { kind: "error", reason: "not-found" };
    }

    const confirmedOn = todayInTaipei();

    const confirmation = await writeClaimConfirmation(
      lookup.rowNumber,
      confirmedOn,
      note,
    );
    if (confirmation.kind !== "ok") {
      console.warn("[claims] confirmation not saved", {
        room,
        period: safePeriod,
        reason: "confirmation-write",
      });
      return { kind: "error", reason: "unavailable" };
    }

    const paid = await writeBillPaidOn(lookup.rowNumber, paidOn);
    if (paid.kind !== "ok") {
      console.warn("[claims] confirmation not saved", {
        room,
        period: safePeriod,
        reason: "paid-write",
      });
      return { kind: "error", reason: "unavailable" };
    }

    const verification = await fetchAppFeedSnapshot();
    if (verification.kind !== "ok") {
      console.warn("[claims] confirmation not saved", {
        room,
        period: safePeriod,
        reason: "verify-read",
      });
      return { kind: "error", reason: "unavailable" };
    }

    const verified = findBillRow(verification.snapshot, room, period);
    if (
      !verified.ok ||
      verified.rowNumber !== lookup.rowNumber ||
      verified.bill.paidOn !== paidOn ||
      verified.bill.confirmedOn !== confirmedOn ||
      (verified.bill.confirmNote ?? "") !== note
    ) {
      console.warn("[claims] confirmation not saved", {
        room,
        period: safePeriod,
        reason: "verify",
      });
      return { kind: "error", reason: "unavailable" };
    }

    revalidateTag(`appfeed:room:${room}`, { expire: 0 });
    return { kind: "ok" };
  } finally {
    try {
      await release();
    } catch {
      console.warn("[claims] confirmation lock release failed");
    }
  }
}

/**
 * Lists pending claims for the admin console. Reads fresh on each call and
 * returns only the room, period, claimed date, and suffix.
 */
export async function listPendingClaims(): Promise<PendingClaimsResult> {
  if (!(await isAdminSession())) return { kind: "denied" };

  const snapshot = await fetchAppFeedSnapshot();
  if (snapshot.kind !== "ok") {
    console.warn("[claims] pending list unavailable", {
      reason: snapshot.reason,
    });
    return { kind: "unavailable" };
  }

  const claims = buildPendingClaims(snapshot.snapshot);
  if (claims === null) {
    console.warn("[claims] pending list unavailable", { reason: "headers" });
    return { kind: "unavailable" };
  }

  return { kind: "ok", claims };
}
