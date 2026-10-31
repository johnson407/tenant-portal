"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, getSessionClaims } from "@/lib/session-cookies";

/**
 * Ends the current browser session.
 *
 * The destination is derived only from the validated session role, never from
 * submitted form data or query parameters. Logout is intentionally local to the
 * browser: no room state or server-side token is changed.
 */
export async function logoutAction(): Promise<void> {
  const claims = await getSessionClaims();

  await clearSessionCookie();

  if (claims?.role === "admin") {
    redirect("/admin/login");
  }

  redirect("/login");
}
