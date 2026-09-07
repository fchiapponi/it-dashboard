import { NextRequest, NextResponse } from "next/server";
import { pollCameraById } from "@/lib/camera-service";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await pollCameraById(id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Poll failed" },
      { status: 500 },
    );
  }
}
