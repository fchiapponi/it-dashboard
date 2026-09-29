import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const printers = await prisma.printer.findMany({
    include: { supplies: true },
    orderBy: { name: "asc" },
  });
  const safe = printers.map(({ snmpCommunity: _snmpCommunity, ...rest }) => rest);
  return NextResponse.json(safe);
}
