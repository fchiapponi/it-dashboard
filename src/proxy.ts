import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: sends visitors without a session cookie to /login.
// The real session lookup happens in requireUser() on every page and action.
export function proxy(request: NextRequest) {
  if (request.cookies.has("helpdesk_session")) return NextResponse.next();
  const url = new URL("/login", request.url);
  const path = request.nextUrl.pathname + request.nextUrl.search;
  if (path !== "/") url.searchParams.set("returnTo", path);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
