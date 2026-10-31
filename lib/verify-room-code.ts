import bcrypt from "bcryptjs";
import { getStoredHash, NO_CODE_CONFIGURED_MESSAGE } from "./code-store";
import { isValidRoomPassword, parseRoomLetter, type RoomLetter } from "./rooms";

export type VerifyRoomCodeResult =
  | { ok: true; room: RoomLetter }
  | {
      ok: false;
      reason: "invalid_input" | "incorrect_code" | "no_code_configured" | "unavailable";
    };

export async function verifyRoomCode(
  roomInput: unknown,
  submitted: unknown,
): Promise<VerifyRoomCodeResult> {
  const room = typeof roomInput === "string" ? parseRoomLetter(roomInput) : null;
  if (!room || !isValidRoomPassword(submitted)) {
    return { ok: false, reason: "invalid_input" };
  }

  let hash: string | null;
  try {
    hash = await getStoredHash(room);
  } catch {
    console.error("KV unavailable while verifying a room code");
    return { ok: false, reason: "unavailable" };
  }
  if (!hash) {
    console.error(NO_CODE_CONFIGURED_MESSAGE);
    return { ok: false, reason: "no_code_configured" };
  }

  const matches = await bcrypt.compare(submitted, hash);
  if (!matches) {
    return { ok: false, reason: "incorrect_code" };
  }

  return { ok: true, room };
}
