"use server";

import { submitRepair } from "@/lib/appfeed/repairs";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { parseRoomLetter } from "@/lib/rooms";
import { getSessionClaims } from "@/lib/session-cookies";
import { getRoomSessionVersion } from "@/lib/session-version";

import { GENERIC_REPAIR_ERROR, type RepairState } from "./repair-state";

export async function submitRepairAction(
  localeInput: string,
  roomInput: string,
  _previous: RepairState,
  formData: FormData,
): Promise<RepairState> {
  const locale = isLocale(localeInput) ? localeInput : DEFAULT_LOCALE;
  void locale;
  void _previous;

  const room =
    typeof roomInput === "string" ? parseRoomLetter(roomInput) : null;
  const claims = await getSessionClaims();
  if (!room || claims?.role !== "tenant" || claims.room !== room) {
    return { status: "error", message: GENERIC_REPAIR_ERROR };
  }

  let authorized = false;
  try {
    authorized = claims.v === (await getRoomSessionVersion(room));
  } catch {
    authorized = false;
  }
  if (!authorized) {
    return { status: "error", message: GENERIC_REPAIR_ERROR };
  }

  let result: Awaited<ReturnType<typeof submitRepair>>;
  try {
    result = await submitRepair(room, {
      category: formData.get("category"),
      note: formData.get("note"),
    });
  } catch {
    console.error("[repairs] submission action failed");
    return { status: "error", message: GENERIC_REPAIR_ERROR };
  }

  if (result.kind === "ok") return { status: "success" };
  if (
    result.reason === "category" ||
    result.reason === "note" ||
    result.reason === "unavailable" ||
    result.reason === "rate"
  ) {
    return { status: "error", message: result.reason };
  }

  return { status: "error", message: GENERIC_REPAIR_ERROR };
}
