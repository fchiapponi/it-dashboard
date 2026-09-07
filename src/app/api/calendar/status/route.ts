import { NextResponse } from "next/server";
import { isCalendarConnected } from "@/lib/google-calendar";

export async function GET() {
  const status = await isCalendarConnected();
  return NextResponse.json(status);
}
