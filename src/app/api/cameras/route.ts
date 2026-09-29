import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const cameras = await prisma.camera.findMany({ orderBy: { name: "asc" } });
  const safe = cameras.map(({ password: _password, ...rest }) => rest);
  return NextResponse.json(safe);
}
