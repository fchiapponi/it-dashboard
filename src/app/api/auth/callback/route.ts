import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_STATE_COOKIE, signIn } from "@/lib/auth";

type IdTokenClaims = { email?: string; email_verified?: boolean; hd?: string; name?: string; picture?: string };

function fail(request: NextRequest, error: string) {
  const url = new URL("/login", process.env.APP_URL ?? request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

/** Google redirects back here with ?code=…&state=… after the user picks an account. */
export async function GET(request: NextRequest) {
  const appUrl = process.env.APP_URL!;
  const params = request.nextUrl.searchParams;
  const store = await cookies();
  const saved = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);

  let expected: { state: string; returnTo: string } | null = null;
  try {
    expected = saved ? JSON.parse(saved) : null;
  } catch {}
  if (!expected || !params.get("state") || params.get("state") !== expected.state) {
    return fail(request, "state");
  }
  const code = params.get("code");
  if (!code) return fail(request, "cancelled");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${appUrl}/api/auth/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return fail(request, "google");
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) return fail(request, "google");

  // The ID token came straight from Google's token endpoint over TLS, so per
  // OpenID Connect Core §3.1.3.7 its signature doesn't need re-verifying here.
  const claims = JSON.parse(Buffer.from(id_token.split(".")[1], "base64url").toString()) as IdTokenClaims;

  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN;
  if (!claims.email || !claims.email_verified) return fail(request, "google");
  if (domain && claims.hd !== domain) return fail(request, "domain");

  await signIn({ email: claims.email, name: claims.name ?? claims.email, image: claims.picture });
  return NextResponse.redirect(new URL(expected.returnTo, appUrl));
}
