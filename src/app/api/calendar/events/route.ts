import { NextResponse } from "next/server";
import { fetchUpcomingEvents } from "@/lib/google-calendar";

export async function GET() {
  try {
    const events = await fetchUpcomingEvents();
    return NextResponse.json(events);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Calendar error" },
      { status: 500 },
    );
  }
}
