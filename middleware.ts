import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySession, type SessionClaims } from "@/lib/session";

export const config = {
  matcher: ["/rooms/:path*", "/admin/:path*"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const claims = await readClaims(request);

  if (pathname.startsWith("/rooms")) {
    if (claims?.role === "tenant") return NextResponse.next();
    return redirectTo(request, "/login");
  }

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    if (claims?.role === "admin") return NextResponse.next();
    return redirectTo(request, "/admin/login");
  }

  return NextResponse.next();
}

function redirectTo(request: NextRequest, loginPath: string) {
  const url = request.nextUrl.clone();
  url.pathname = loginPath;
  url.search = "";
  return NextResponse.redirect(url);
}

async function readClaims(request: NextRequest): Promise<SessionClaims | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}
