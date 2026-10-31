import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySession, type SessionClaims } from "@/lib/session";

export const config = {
  matcher: ["/rooms/:path*", "/admin/:path*"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const claims = await readClaims(request);

  if (pathname.startsWith("/rooms")) {
    if (claims?.role === "tenant") return allow();
    return redirectTo(request, "/login");
  }

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return allow();
    if (claims?.role === "admin") return allow();
    return redirectTo(request, "/admin/login");
  }

  return NextResponse.next();
}

function allow() {
  return noStore(NextResponse.next());
}

function redirectTo(request: NextRequest, loginPath: string) {
  const url = request.nextUrl.clone();
  url.pathname = loginPath;
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
