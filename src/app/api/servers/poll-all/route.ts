import { NextResponse } from "next/server";
import { pollAllServers } from "@/lib/server-service";

export async function POST() {
  const results = await pollAllServers();
  return NextResponse.json({ results });
}
