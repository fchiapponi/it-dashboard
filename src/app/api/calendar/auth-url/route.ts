import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google-calendar";

export async function GET() {
  try {
    const url = getGoogleAuthUrl();
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Missing configuration" },
      { status: 500 },
    );
  }
}
