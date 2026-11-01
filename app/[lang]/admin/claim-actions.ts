"use server";

import { confirmClaim } from "@/lib/appfeed/claims";
import { isAdminSession } from "@/lib/session-cookies";

import {
  GENERIC_CLAIM_CONFIRM_ERROR,
  type ClaimConfirmState,
} from "./claim-state";

const ROOM_PATTERN = /^[a-e]$/;

export async function confirmClaimAction(
  _localeInput: string,
  _previous: ClaimConfirmState,
  formData: FormData,
): Promise<ClaimConfirmState> {
  void _previous;

  if (!(await isAdminSession())) {
    return { status: "error", message: GENERIC_CLAIM_CONFIRM_ERROR };
  }

  const room = formData.get("room");
  const period = formData.get("period");
  const paidOn = formData.get("paidOn");
  if (
    typeof room !== "string" ||
    !ROOM_PATTERN.test(room) ||
    typeof period !== "string"
  ) {
    return { status: "error", message: "not-found" };
  }
  if (typeof paidOn !== "string") {
    return { status: "error", message: "date" };
  }

  const note = formData.get("note");
  if (note !== null && typeof note !== "string") {
    return { status: "error", message: "note" };
  }

  let result: Awaited<ReturnType<typeof confirmClaim>>;
  try {
    result = await confirmClaim(
      room as "a" | "b" | "c" | "d" | "e",
      period,
      paidOn,
      note ?? "",
    );
  } catch {
    console.error("[claims] confirmation action failed");
    return { status: "error", message: GENERIC_CLAIM_CONFIRM_ERROR };
  }

  if (result.kind === "ok") return { status: "success" };
  if (result.kind === "denied") {
    return { status: "error", message: GENERIC_CLAIM_CONFIRM_ERROR };
  }
  if (
    result.reason === "date" ||
    result.reason === "note" ||
    result.reason === "not-found" ||
    result.reason === "paid" ||
    result.reason === "unavailable" ||
    result.reason === "rate"
  ) {
    return { status: "error", message: result.reason };
  }

  return { status: "error", message: GENERIC_CLAIM_CONFIRM_ERROR };
}
