"use server";

import { redirect } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/lib/i18n/config";
import { clearSessionCookie, getSessionClaims } from "@/lib/session-cookies";

/**
 * Ends the current browser session.
 *
 * The destination is derived only from the validated session role and the
 * validated locale, never from submitted form data or query parameters. Logout
 * is intentionally local to the browser: no room state or server-side token is
 * changed.
 */
export async function logoutAction(localeInput?: string): Promise<void> {
  const requested = typeof localeInput === "string" ? localeInput : "";
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  const claims = await getSessionClaims();

  await clearSessionCookie();

  if (claims?.role === "admin") {
    redirect(localePath(locale, "/admin/login"));
  }

  redirect(localePath(locale, "/login"));
}
