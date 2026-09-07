import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().optional(),
  protocol: z.enum(["onvif", "rtsp", "mjpeg"]).optional(),
  host: z.string().min(1).optional(),
  port: z.number().int().optional(),
  rtspPath: z.string().optional(),
  snapshotUrl: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const camera = await prisma.camera.findUnique({ where: { id } });
  if (!camera) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { password: _password, ...safe } = camera;
  return NextResponse.json(safe);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = { ...parsed.data };
  if (data.password) {
    data.password = encryptSecret(data.password);
  }
  const camera = await prisma.camera.update({ where: { id }, data });
  const { password: _password, ...safe } = camera;
  return NextResponse.json(safe);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.camera.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
