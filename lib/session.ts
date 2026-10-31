import { SignJWT, jwtVerify } from "jose";
import { isRoomLetter, type RoomLetter } from "./rooms";

export const SESSION_COOKIE_NAME = "tp_session";

export const TENANT_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export type TenantClaims = { role: "tenant"; room: RoomLetter; v: number; exp: number };
export type AdminClaims = { role: "admin"; exp: number };
export type SessionClaims = TenantClaims | AdminClaims;

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 8) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function signTenantSession(room: RoomLetter, sessionVersion: number): Promise<string> {
  return new SignJWT({ role: "tenant", room, v: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TENANT_SESSION_MAX_AGE_SECONDS + "s")
    .sign(secretKey());
}

export async function signAdminSession(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TENANT_SESSION_MAX_AGE_SECONDS + "s")
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.role === "tenant") {
      const room = typeof payload.room === "string" ? payload.room : null;
      if (!room || !isRoomLetter(room) || typeof payload.exp !== "number") return null;
      if (typeof payload.v !== "number" || !Number.isInteger(payload.v) || payload.v < 0) return null;
      return { role: "tenant", room, v: payload.v, exp: payload.exp };
    }
    if (payload.role === "admin") {
      if (typeof payload.exp !== "number") return null;
      return { role: "admin", exp: payload.exp };
    }
    return null;
  } catch {
    return null;
  }
}
