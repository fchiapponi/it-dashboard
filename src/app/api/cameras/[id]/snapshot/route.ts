import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const camera = await prisma.camera.findUnique({ where: { id } });
  if (!camera || !camera.snapshotUrl) {
    return NextResponse.json({ error: "No snapshot available" }, { status: 404 });
  }

  const headers: HeadersInit = {};
  if (camera.username) {
    const password = camera.password ? decryptSecret(camera.password) : "";
    headers.Authorization = "Basic " + Buffer.from(`${camera.username}:${password}`).toString("base64");
  }

  try {
    const upstream = await fetch(camera.snapshotUrl, { headers, cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: `Snapshot non disponibile (${upstream.status})` }, { status: 502 });
    }
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Snapshot proxy error" },
      { status: 502 },
    );
  }
}
