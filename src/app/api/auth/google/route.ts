import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_STATE_COOKIE } from "@/lib/auth";
import { safeReturnTo } from "@/lib/format";

/** Starts the Google sign-in: redirects to Google's consent screen. */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.APP_URL;
  if (!clientId || !appUrl) {
    return new NextResponse("Google sign-in is not configured (GOOGLE_CLIENT_ID / APP_URL).", { status: 500 });
  }

  const state = randomBytes(24).toString("base64url");
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  (await cookies()).set(OAUTH_STATE_COOKIE, JSON.stringify({ state, returnTo }), {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl.startsWith("https://"),
    path: "/api/auth",
    maxAge: 600,
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    // Only a hint for the account chooser; the callback enforces the domain.
    hd: process.env.GOOGLE_WORKSPACE_DOMAIN ?? "",
  }).toString();
  return NextResponse.redirect(url);
}
