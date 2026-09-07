import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";

const createSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
  protocol: z.enum(["onvif", "rtsp", "mjpeg"]).default("onvif"),
  host: z.string().min(1),
  port: z.number().int().default(80),
  rtspPath: z.string().optional(),
  snapshotUrl: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

export async function GET() {
  const cameras = await prisma.camera.findMany({ orderBy: { name: "asc" } });
  const safe = cameras.map(({ password: _password, ...rest }) => rest);
  return NextResponse.json(safe);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const camera = await prisma.camera.create({
    data: {
      name: data.name,
      location: data.location,
      protocol: data.protocol,
      host: data.host,
      port: data.port,
      rtspPath: data.rtspPath,
      snapshotUrl: data.snapshotUrl,
      username: data.username,
      password: data.password ? encryptSecret(data.password) : undefined,
    },
  });
  const { password: _password, ...safe } = camera;
  return NextResponse.json(safe, { status: 201 });
}
