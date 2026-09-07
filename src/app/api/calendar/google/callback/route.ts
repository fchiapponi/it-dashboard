import { NextRequest, NextResponse } from "next/server";
import { handleGoogleOAuthCallback } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const base = req.nextUrl.origin;
  if (!code) {
    return NextResponse.redirect(`${base}/calendario?error=missing_code`);
  }
  try {
    await handleGoogleOAuthCallback(code);
    return NextResponse.redirect(`${base}/calendario?connected=1`);
  } catch (err) {
    const message = encodeURIComponent(err instanceof Error ? err.message : "Unknown error");
    return NextResponse.redirect(`${base}/calendario?error=${message}`);
  }
}
