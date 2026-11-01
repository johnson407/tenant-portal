"use server";

import { completeRepair } from "@/lib/appfeed/repairs";
import { isAdminSession } from "@/lib/session-cookies";

import {
  GENERIC_REPAIR_DONE_ERROR,
  type RepairDoneState,
} from "./repair-state";

export async function markRepairDoneAction(
  _localeInput: string,
  _previous: RepairDoneState,
  formData: FormData,
): Promise<RepairDoneState> {
  void _previous;

  if (!(await isAdminSession())) {
    return { status: "error", message: GENERIC_REPAIR_DONE_ERROR };
  }

  const requestId = formData.get("requestId");
  if (typeof requestId !== "string") {
    return { status: "error", message: "not-found" };
  }

  const note = formData.get("note");
  if (note !== null && typeof note !== "string") {
    return { status: "error", message: "invalid-note" };
  }

  let result: Awaited<ReturnType<typeof completeRepair>>;
  try {
    result = await completeRepair(requestId, note ?? "");
  } catch {
    console.error("[repairs] completion action failed");
    return { status: "error", message: GENERIC_REPAIR_DONE_ERROR };
  }

  if (result.kind === "ok") return { status: "success" };
  if (result.kind === "denied") {
    return { status: "error", message: GENERIC_REPAIR_DONE_ERROR };
  }
  if (
    result.reason === "already-done" ||
    result.reason === "not-found" ||
    result.reason === "invalid-note" ||
    result.reason === "unavailable" ||
    result.reason === "rate"
  ) {
    return { status: "error", message: result.reason };
  }

  return { status: "error", message: GENERIC_REPAIR_DONE_ERROR };
}
