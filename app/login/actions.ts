"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import {
  signTenantSession,
  SESSION_COOKIE_NAME,
  TENANT_SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";
import { getRoomSessionVersion } from "@/lib/session-version";
import { verifyRoomCode } from "@/lib/verify-room-code";
import { parseRoomLetter } from "@/lib/rooms";
import { clientIpFromHeaders } from "@/lib/client-ip";
import {
  LOGIN_RATE_BUCKET,
  clearRateLimit,
  consumeAttempt,
  type RateLimitDecision,
} from "@/lib/rate-limit";
import { GENERIC_LOGIN_ERROR, type LoginState } from "./login-state";

async function limiterKeys(roomInput: string): Promise<string[]> {
  const headerList = await headers();
  const ip = clientIpFromHeaders(headerList);
  const room = parseRoomLetter(roomInput);
  return room ? [`ip:${ip}`, `room:${room}`] : [`ip:${ip}`];
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  void _prev;
  const roomInput = String(formData.get("room") ?? "");
  const code = String(formData.get("code") ?? "");

  const keys = await limiterKeys(roomInput);
  let decision: RateLimitDecision;
  try {
    decision = await consumeAttempt(LOGIN_RATE_BUCKET, keys);
  } catch {
    console.error("Rate limiting is unavailable for tenant login");
    return { error: GENERIC_LOGIN_ERROR };
  }
  if (!decision.allowed) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  const result = await verifyRoomCode(roomInput, code);
  if (!result.ok) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  let sessionVersion: number;
  try {
    sessionVersion = await getRoomSessionVersion(result.room);
  } catch {
    console.error("KV unavailable while issuing a tenant session");
    return { error: GENERIC_LOGIN_ERROR };
  }

  const token = await signTenantSession(result.room, sessionVersion);
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TENANT_SESSION_MAX_AGE_SECONDS,
  });

  await clearRateLimit(LOGIN_RATE_BUCKET, keys);
  redirect(`/rooms/${result.room}`);
}
