import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { SESSION_COOKIE_NAME, verifySession, type SessionClaims } from "@/lib/session";

export const config = {
  // Match app routes, including bare paths that need a locale prefix, while
  // skipping framework assets and dotted file paths.
  matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"],
};

type LocalizedPath = { locale: Locale; path: string };

function splitLocale(pathname: string): LocalizedPath | null {
  const segments = pathname.split("/");
  const first = segments[1] ?? "";
  if (!isLocale(first)) return null;

  const rest = segments.slice(2).join("/");
  return { locale: first, path: rest ? `/${rest}` : "/" };
}

function isPathWithin(path: string, section: string): boolean {
  return path === section || path.startsWith(`${section}/`);
}

export async function middleware(request: NextRequest) {
  const localized = splitLocale(request.nextUrl.pathname);

  if (!localized) {
    const url = request.nextUrl.clone();
    url.pathname = localePath(DEFAULT_LOCALE, request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const { locale, path } = localized;
  const claims = await readClaims(request);

  if (isPathWithin(path, "/rooms")) {
    if (claims?.role === "tenant") return allow();
    return redirectTo(request, localePath(locale, "/login"));
  }

  if (isPathWithin(path, "/admin")) {
    if (path === "/admin/login") return allow();
    if (claims?.role === "admin") return allow();
    return redirectTo(request, localePath(locale, "/admin/login"));
  }

  return NextResponse.next();
}

function allow() {
  return noStore(NextResponse.next());
}

function redirectTo(request: NextRequest, destination: string) {
  const url = request.nextUrl.clone();
  url.pathname = destination;
  url.search = "";
  return noStore(NextResponse.redirect(url));
}

// Protected content must never be served from a cache after logout, including
// on Back/reload navigations.
function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function readClaims(request: NextRequest): Promise<SessionClaims | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}
