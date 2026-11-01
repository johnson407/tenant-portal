"use server";

import { submitClaim } from "@/lib/appfeed/claims";
import { parseRoomLetter } from "@/lib/rooms";
import { getSessionClaims } from "@/lib/session-cookies";
import { getRoomSessionVersion } from "@/lib/session-version";

import { GENERIC_CLAIM_ERROR, type ClaimState } from "./claim-state";

export async function submitClaimAction(
  localeInput: string,
  roomInput: string,
  _previous: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  void localeInput;
  void _previous;

  const room = parseRoomLetter(roomInput);
  const claims = await getSessionClaims();
  if (!room || claims?.role !== "tenant" || claims.room !== room) {
    return { status: "error", message: GENERIC_CLAIM_ERROR };
  }

  let authorized = false;
  try {
    authorized = claims.v === (await getRoomSessionVersion(room));
  } catch {
    authorized = false;
  }
  if (!authorized) {
    return { status: "error", message: GENERIC_CLAIM_ERROR };
  }

  const result = await submitClaim(room, String(formData.get("period") ?? ""), {
    claimedOn: formData.get("claimedOn"),
    bankLast5: formData.get("bankLast5"),
  });

  if (result.kind === "ok") return { status: "success" };
  if (result.reason === "date" || result.reason === "suffix") {
    return { status: "error", message: result.reason };
  }

  return { status: "error", message: GENERIC_CLAIM_ERROR };
}
