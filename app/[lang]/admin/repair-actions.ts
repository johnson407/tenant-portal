"use server";

import { completeRepair } from "@/lib/appfeed/repairs";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { isAdminSession } from "@/lib/session-cookies";

import {
  GENERIC_REPAIR_DONE_ERROR,
  type RepairDoneState,
} from "./repair-state";

export async function markRepairDoneAction(
  localeInput: string,
  _previous: RepairDoneState,
  formData: FormData,
): Promise<RepairDoneState> {
  const locale = isLocale(localeInput) ? localeInput : DEFAULT_LOCALE;
  void locale;
  void _previous;

  if (!(await isAdminSession())) {
    return { status: "error", message: GENERIC_REPAIR_DONE_ERROR };
  }

  const requestId = formData.get("requestId");
  if (typeof requestId !== "string") {
    return { status: "error", message: "not-found" };
  }

  let result: Awaited<ReturnType<typeof completeRepair>>;
  try {
    result = await completeRepair(requestId);
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
    result.reason === "unavailable" ||
    result.reason === "rate"
  ) {
    return { status: "error", message: result.reason };
  }

  return { status: "error", message: GENERIC_REPAIR_DONE_ERROR };
}
