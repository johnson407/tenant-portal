"use server";

import { redirect } from "next/navigation";
import {
  ADMIN_LOGIN_RATE_BUCKET,
  clearRateLimit,
  consumeAttempt,
  type RateLimitDecision,
} from "@/lib/rate-limit";
import { adminPasswordMatches, clientIpKeys, establishAdminSession } from "@/lib/admin-auth";
import { GENERIC_ADMIN_LOGIN_ERROR, type AdminLoginState } from "../login-state";

export async function adminLoginAction(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  void _prev;
  const password = String(formData.get("password") ?? "");

  const keys = await clientIpKeys();
  let decision: RateLimitDecision;
  try {
    decision = await consumeAttempt(ADMIN_LOGIN_RATE_BUCKET, keys);
  } catch {
    console.error("Rate limiting is unavailable for admin login");
    return { error: GENERIC_ADMIN_LOGIN_ERROR };
  }
  if (!decision.allowed) {
    return { error: GENERIC_ADMIN_LOGIN_ERROR };
  }

  if (!adminPasswordMatches(password)) {
    return { error: GENERIC_ADMIN_LOGIN_ERROR };
  }

  await clearRateLimit(ADMIN_LOGIN_RATE_BUCKET, keys);
  await establishAdminSession();
  redirect("/admin");
}
