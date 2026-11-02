"use server";

import {
  completeRepair,
  updateRepairExpense,
  updateRepairStatus,
} from "@/lib/appfeed/repairs";
import { isAdminSession } from "@/lib/session-cookies";

import {
  GENERIC_REPAIR_DONE_ERROR,
  type RepairDoneState,
} from "./repair-state";
import type { RepairUpdateState } from "./repair-update-state";
import type { RepairExpenseState } from "./repair-expense-state";

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

export async function updateRepairStatusAction(
  _localeInput: string,
  _previous: RepairUpdateState,
  formData: FormData,
): Promise<RepairUpdateState> {
  void _previous;

  if (!(await isAdminSession())) {
    return { status: "error", message: GENERIC_REPAIR_DONE_ERROR };
  }

  const requestId = formData.get("requestId");
  if (typeof requestId !== "string") {
    return { status: "error", message: "not-found" };
  }

  const status = formData.get("status");
  if (typeof status !== "string") {
    return { status: "error", message: "invalid-status" };
  }

  const visitStart = formData.get("visitStart");
  const visitEnd = formData.get("visitEnd");
  if (typeof visitStart !== "string" || typeof visitEnd !== "string") {
    return { status: "error", message: "invalid-window" };
  }

  const toTaipeiTimestamp = (value: string) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
      ? `${value}+08:00`
      : value;

  let result: Awaited<ReturnType<typeof updateRepairStatus>>;
  try {
    result = await updateRepairStatus(
      requestId,
      status,
      toTaipeiTimestamp(visitStart),
      toTaipeiTimestamp(visitEnd),
    );
  } catch {
    console.error("[repairs] status action failed");
    return { status: "error", message: GENERIC_REPAIR_DONE_ERROR };
  }

  if (result.kind === "ok") return { status: "success" };
  if (result.kind === "denied") {
    return { status: "error", message: GENERIC_REPAIR_DONE_ERROR };
  }

  return { status: "error", message: result.reason };
}

export async function updateRepairExpenseAction(
  _localeInput: string,
  _previous: RepairExpenseState,
  formData: FormData,
): Promise<RepairExpenseState> {
  void _previous;

  if (!(await isAdminSession())) {
    return { status: "error", message: GENERIC_REPAIR_DONE_ERROR };
  }

  const requestId = formData.get("requestId");
  if (typeof requestId !== "string") {
    return { status: "error", message: "not-found" };
  }
  const expenseAmount = formData.get("expenseAmount");
  if (typeof expenseAmount !== "string") {
    return { status: "error", message: "invalid-amount" };
  }

  try {
    const result = await updateRepairExpense(requestId, expenseAmount);
    if (result.kind === "ok") return { status: "success" };
    if (result.kind === "denied") {
      return { status: "error", message: GENERIC_REPAIR_DONE_ERROR };
    }
    return { status: "error", message: result.reason };
  } catch {
    console.error("[repairs] expense action failed");
    return { status: "error", message: GENERIC_REPAIR_DONE_ERROR };
  }
}
