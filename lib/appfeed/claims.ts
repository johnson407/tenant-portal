import "server-only";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { isRoomLetter, type RoomLetter } from "../rooms";
import { clientIpFromHeaders } from "../client-ip";
import { isAdminSession } from "../session-cookies";
import { CLAIM_RATE_BUCKET, consumeAttempt } from "../rate-limit";
import type { PendingClaim } from "./types";
import { fetchAppFeedSnapshot, writeClaimCells } from "./google";
import {
  BANK_LAST5_PATTERN,
  PERIOD_PATTERN,
  buildPendingClaims,
  findBillRow,
  isRealIsoDate,
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

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/** Returns today's date in Asia/Taipei as YYYY-MM-DD. */
export function todayInTaipei(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
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
  if (!lookup.ok || lookup.bill.paidOn !== null) {
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
