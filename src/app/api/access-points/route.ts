import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { fetchAccessPoints } from "@/lib/meraki";

export async function GET() {
  if (!(await getUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
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
