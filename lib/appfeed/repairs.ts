import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { isRoomLetter, type RoomLetter } from "../rooms";
import { clientIpFromHeaders } from "../client-ip";
import { isAdminSession } from "../session-cookies";
import {
  REPAIR_DONE_RATE_BUCKET,
  REPAIR_SUBMIT_RATE_BUCKET,
  consumeAttempt,
} from "../rate-limit";
import type {
  AdminRepairsResult,
  RepairInput,
  RoomRepairsResult,
} from "./types";
import {
  appendRepairRow,
  fetchRepairsSnapshot,
  writeRepairDone,
} from "./google";
import {
  REPAIR_ID_PATTERN,
  buildPendingRepairs,
  buildRoomRepairs,
  findRepairRow,
  isRepairCategory,
  isValidRepairNote,
} from "./validate";
import { todayInTaipei } from "./dates";
import { acquireRepairDoneLock } from "./repair-lock";
import { AppFeedUnavailableError } from "./feed";

export type RepairInputFields = {
  category: unknown;
  note: unknown;
};

export type ParsedRepairInput =
  | { ok: true; value: RepairInput }
  | { ok: false; reason: "category" | "note" };

export type RepairSubmitResult =
  | { kind: "ok" }
  | {
      kind: "error";
      reason: "category" | "note" | "unavailable" | "rate" | "generic";
    };

export type CompleteRepairResult =
  | { kind: "ok" }
  | { kind: "denied" }
  | {
      kind: "error";
      reason: "already-done" | "not-found" | "unavailable" | "rate" | "generic";
    };

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/** Validates the category and note from a tenant form. */
export function parseRepairInput(
  input: RepairInputFields,
): ParsedRepairInput {
  if (typeof input.category !== "string") {
    return { ok: false, reason: "category" };
  }
  const category = input.category.trim();
  if (!isRepairCategory(category)) {
    return { ok: false, reason: "category" };
  }

  if (typeof input.note !== "string") {
    return { ok: false, reason: "note" };
  }
  if (!isValidRepairNote(input.note)) {
    return { ok: false, reason: "note" };
  }

  return { ok: true, value: { category, note: input.note.trim() } };
}

function newRepairRequestId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function submitLimiterKeys(room: RoomLetter): Promise<string[]> {
  const headerList = await headers();
  return [`ip:${clientIpFromHeaders(headerList)}`, `room:${room}`];
}

async function completionLimiterKeys(): Promise<string[]> {
  const headerList = await headers();
  return [`ip:${clientIpFromHeaders(headerList)}`];
}

/**
 * Returns only the requested room's repair projection. The sheet is read and
 * filtered inside this cached function; the raw snapshot never escapes.
 */
export async function getRoomRepairs(
  room: RoomLetter,
): Promise<RoomRepairsResult> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  cacheTag(`appfeed:repairs:room:${room}`);

  if (!isRoomLetter(room)) throw new AppFeedUnavailableError();

  const snapshot = await fetchRepairsSnapshot();

  if (snapshot.kind === "unavailable") {
    if (snapshot.transient) throw new AppFeedUnavailableError();
    return { kind: "unavailable" };
  }

  return buildRoomRepairs(snapshot.snapshot, room);
}

/**
 * Lists pending repairs for the admin console. Reads fresh on each call and
 * returns only the room, request ID, category, note, and submitted date.
 */
export async function listPendingRepairs(): Promise<AdminRepairsResult> {
  if (!(await isAdminSession())) return { kind: "denied" };

  const snapshot = await fetchRepairsSnapshot();
  if (snapshot.kind !== "ok") {
    console.warn("[repairs] pending list unavailable", {
      reason: snapshot.reason,
    });
    return { kind: "unavailable" };
  }

  const repairs = buildPendingRepairs(snapshot.snapshot);
  if (repairs === null) {
    console.warn("[repairs] pending list unavailable", { reason: "invalid" });
    return { kind: "unavailable" };
  }

  return { kind: "ok", repairs };
}

/**
 * Appends one pending repair row for the session's room. The caller checks the
 * tenant session and room version before this write. The request ID, submitted
 * date, and status come from the server, never from the form.
 */
export async function submitRepair(
  room: RoomLetter,
  input: RepairInputFields,
): Promise<RepairSubmitResult> {
  if (!isRoomLetter(room)) return { kind: "error", reason: "unavailable" };

  const parsed = parseRepairInput(input);
  if (!parsed.ok) return { kind: "error", reason: parsed.reason };

  let allowed = false;
  try {
    const decision = await consumeAttempt(
      REPAIR_SUBMIT_RATE_BUCKET,
      await submitLimiterKeys(room),
    );
    allowed = decision.allowed;
  } catch {
    console.warn("[repairs] submission not saved", {
      reason: "limiter",
    });
    return { kind: "error", reason: "unavailable" };
  }
  if (!allowed) {
    console.warn("[repairs] submission not saved", {
      reason: "rate-limit",
    });
    return { kind: "error", reason: "rate" };
  }

  const snapshot = await fetchRepairsSnapshot();
  if (snapshot.kind !== "ok") {
    console.warn("[repairs] submission not saved", {
      reason: "read",
    });
    return { kind: "error", reason: "unavailable" };
  }

  const roomRepairs = buildRoomRepairs(snapshot.snapshot, room);
  if (roomRepairs.kind !== "ok") {
    console.warn("[repairs] submission not saved", {
      reason: "invalid",
    });
    return { kind: "error", reason: "unavailable" };
  }

  const appended = await appendRepairRow({
    room,
    requestId: newRepairRequestId(),
    category: parsed.value.category,
    note: parsed.value.note,
    submittedOn: todayInTaipei(),
  });
  if (appended.kind !== "ok") {
    console.warn("[repairs] submission not saved", {
      reason: "write",
    });
    return { kind: "error", reason: "unavailable" };
  }

  revalidateTag(`appfeed:repairs:room:${room}`, { expire: 0 });
  return { kind: "ok" };
}

/**
 * Marks one pending repair done. Reads fresh, rejects an unknown or completed
 * request, writes only the status cells, and refreshes that room's history.
 */
export async function completeRepair(
  requestId: string,
): Promise<CompleteRepairResult> {
  if (!(await isAdminSession())) return { kind: "denied" };

  const id = text(requestId);
  if (!REPAIR_ID_PATTERN.test(id)) {
    return { kind: "error", reason: "not-found" };
  }

  let allowed = false;
  try {
    const decision = await consumeAttempt(
      REPAIR_DONE_RATE_BUCKET,
      await completionLimiterKeys(),
    );
    allowed = decision.allowed;
  } catch {
    console.warn("[repairs] completion not saved", { reason: "limiter" });
    return { kind: "error", reason: "unavailable" };
  }
  if (!allowed) {
    console.warn("[repairs] completion not saved", { reason: "rate-limit" });
    return { kind: "error", reason: "rate" };
  }

  let release: (() => Promise<void>) | null = null;
  try {
    release = await acquireRepairDoneLock(id);
  } catch {
    console.warn("[repairs] completion not saved", { reason: "lock" });
    return { kind: "error", reason: "unavailable" };
  }
  if (release === null) {
    console.warn("[repairs] completion not saved", { reason: "locked" });
    return { kind: "error", reason: "unavailable" };
  }

  try {
    const snapshot = await fetchRepairsSnapshot();
    if (snapshot.kind !== "ok") {
      console.warn("[repairs] completion not saved", {
        reason: snapshot.reason,
      });
      return { kind: "error", reason: "unavailable" };
    }

    const lookup = findRepairRow(snapshot.snapshot, id);
    if (!lookup.ok) {
      if (lookup.reason === "not-found") {
        return { kind: "error", reason: "not-found" };
      }
      console.warn("[repairs] completion not saved", {
        reason: lookup.reason,
      });
      return { kind: "error", reason: "unavailable" };
    }

    if (lookup.repair.status !== "pending") {
      return { kind: "error", reason: "already-done" };
    }

    const doneOn = todayInTaipei();
    if (doneOn < lookup.repair.submittedOn) {
      console.warn("[repairs] completion not saved", { reason: "date" });
      return { kind: "error", reason: "unavailable" };
    }

    const written = await writeRepairDone(lookup.rowNumber, doneOn);
    if (written.kind !== "ok") {
      console.warn("[repairs] completion not saved", { reason: "write" });
      return { kind: "error", reason: "unavailable" };
    }

    // The write uses a row number from the first read. Verify the same request
    // is done in the same row, so a manual insert cannot make us report success
    // for another request.
    const verification = await fetchRepairsSnapshot();
    if (verification.kind !== "ok") {
      console.warn("[repairs] completion not saved", {
        reason: "verify-read",
      });
      return { kind: "error", reason: "unavailable" };
    }

    const verified = findRepairRow(verification.snapshot, id);
    if (
      !verified.ok ||
      verified.rowNumber !== lookup.rowNumber ||
      verified.repair.status !== "done" ||
      verified.repair.doneOn !== doneOn
    ) {
      console.warn("[repairs] completion not saved", { reason: "verify" });
      return { kind: "error", reason: "unavailable" };
    }

    revalidateTag(`appfeed:repairs:room:${lookup.repair.room}`, {
      expire: 0,
    });
    return { kind: "ok" };
  } finally {
    try {
      await release();
    } catch {
      console.warn("[repairs] completion lock release failed");
    }
  }
}
