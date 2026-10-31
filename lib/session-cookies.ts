import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  TENANT_SESSION_MAX_AGE_SECONDS,
  verifySession,
  type SessionClaims,
} from "./session";
import type { RoomLetter } from "./rooms";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

type CookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TENANT_SESSION_MAX_AGE_SECONDS,
  };
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, cookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 });
}

export async function getSessionClaims(): Promise<SessionClaims | null> {
  const store = await cookies();
  return readClaimsFromCookie(store.get(SESSION_COOKIE_NAME));
}

async function readClaimsFromCookie(cookie: CookieStore extends { get(name: string): infer G } ? G : unknown): Promise<SessionClaims | null> {
  if (!cookie) return null;
  return verifySession(cookie.value);
}

export async function getTenantRoom(): Promise<RoomLetter | null> {
  const claims = await getSessionClaims();
  return claims?.role === "tenant" ? claims.room : null;
}

export async function isAdminSession(): Promise<boolean> {
  const claims = await getSessionClaims();
  return claims?.role === "admin";
}

export { SESSION_COOKIE_NAME };
