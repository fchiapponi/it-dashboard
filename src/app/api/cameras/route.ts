import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await getUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const cameras = await prisma.camera.findMany({ orderBy: { name: "asc" } });
  const safe = cameras.map(({ password: _password, ...rest }) => rest);
  return NextResponse.json(safe);
}
