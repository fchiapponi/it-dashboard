import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await getUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const servers = await prisma.server.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(servers);
}
