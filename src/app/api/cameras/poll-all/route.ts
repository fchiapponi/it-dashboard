import { NextResponse } from "next/server";
import { pollAllCameras } from "@/lib/camera-service";

export async function POST() {
  const results = await pollAllCameras();
  return NextResponse.json({ results });
}
