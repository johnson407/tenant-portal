"use server";

import bcrypt from "bcryptjs";
import { getSessionClaims } from "@/lib/session-cookies";
import { isValidRoomPassword, parseRoomLetter } from "@/lib/rooms";
import { PASSWORD_HASH_COST, setStoredHash } from "@/lib/code-store";
import { bumpRoomSessionVersion } from "@/lib/session-version";
import {
  ADMIN_RESET_RATE_BUCKET,
  clearRateLimit,
  consumeAttempt,
  type RateLimitDecision,
} from "@/lib/rate-limit";
import { clientIpKeys } from "@/lib/admin-auth";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { GENERIC_ADMIN_RESET_ERROR, type AdminResetState } from "./login-state";

function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

async function recordResetFailure(): Promise<void> {
  try {
    const keys = await clientIpKeys();
    await consumeAttempt(ADMIN_RESET_RATE_BUCKET, keys);
  } catch {
    console.error("Rate limiting is unavailable for admin reset");
  }
}

// Admin-only: any tenant or anonymous caller is rejected here before any
// hash generation or store write happens.
export async function resetRoomCodeAction(
  localeInput: string,
  _prev: AdminResetState,
  formData: FormData,
): Promise<AdminResetState> {
  void _prev;
  const locale = isLocale(localeInput) ? localeInput : DEFAULT_LOCALE;
  void locale;
  const claims = await getSessionClaims();
  if (claims?.role !== "admin") {
    await recordResetFailure();
    return { status: "error", message: GENERIC_ADMIN_RESET_ERROR };
  }

  const room = parseRoomLetter(String(formData.get("room") ?? ""));
  if (!room) {
    return { status: "error", message: "invalid-room" };
  }

  const chosen = String(formData.get("code") ?? "");
  const code = chosen === "" ? generateRoomCode() : chosen;
  if (!isValidRoomPassword(code)) {
    return { status: "error", message: "invalid-password" };
  }

  // Validate input before consuming an attempt so a typo does not count
  // toward the admin-reset lockout. Only real reset attempts are limited.
  const keys = await clientIpKeys();
  let decision: RateLimitDecision;
  try {
    decision = await consumeAttempt(ADMIN_RESET_RATE_BUCKET, keys);
  } catch {
    console.error("Rate limiting is unavailable for admin reset");
    return { status: "error", message: GENERIC_ADMIN_RESET_ERROR };
  }
  if (!decision.allowed) {
    return { status: "error", message: GENERIC_ADMIN_RESET_ERROR };
  }

  try {
    const hash = await bcrypt.hash(code, PASSWORD_HASH_COST);
    await bumpRoomSessionVersion(room);
    await setStoredHash(room, hash);
  } catch {
    console.error("Admin reset failed while writing the new code");
    return { status: "error", message: GENERIC_ADMIN_RESET_ERROR };
  }

  await clearRateLimit(ADMIN_RESET_RATE_BUCKET, keys);

  return { status: "success", room, code };
}
