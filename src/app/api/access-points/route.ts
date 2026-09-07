import { NextResponse } from "next/server";
import { fetchAccessPoints } from "@/lib/meraki";

export async function GET() {
  try {
    const accessPoints = await fetchAccessPoints();
    return NextResponse.json(accessPoints);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Meraki API error" },
      { status: 500 },
    );
  }
}
