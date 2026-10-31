import { timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE_NAME, signAdminSession } from "@/lib/session";
import { clientIpFromHeaders } from "@/lib/client-ip";

export async function clientIpKeys(): Promise<string[]> {
  const headerList = await headers();
  return [`ip:${clientIpFromHeaders(headerList)}`];
}

// Zero-padding keeps both buffers a constant length, avoiding a length-based
// timing signal while still rejecting a wrong password outright.
function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  const maxLen = Math.max(bufA.length, bufB.length, 1);
  const padded = (buf: Buffer) => Buffer.concat([buf, Buffer.alloc(maxLen - buf.length)]);
  return timingSafeEqual(padded(bufA), padded(bufB));
}

export function adminPasswordMatches(submitted: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (typeof expected !== "string" || expected.length === 0) return false;
  return timingSafeEqualStrings(submitted, expected);
}

export async function establishAdminSession(): Promise<void> {
  const token = await signAdminSession();
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}
