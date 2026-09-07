import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";

const createSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
  ipAddress: z.string().min(1),
  snmpCommunity: z.string().default("public"),
  snmpVersion: z.union([z.literal(1), z.literal(2)]).default(2),
  model: z.string().optional(),
});

export async function GET() {
  const printers = await prisma.printer.findMany({
    include: { supplies: true },
    orderBy: { name: "asc" },
  });
  const safe = printers.map(({ snmpCommunity: _snmpCommunity, ...rest }) => rest);
  return NextResponse.json(safe);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const printer = await prisma.printer.create({
    data: {
      name: data.name,
      location: data.location,
      ipAddress: data.ipAddress,
      snmpCommunity: encryptSecret(data.snmpCommunity),
      snmpVersion: data.snmpVersion,
      model: data.model,
    },
  });
  const { snmpCommunity: _snmpCommunity, ...safe } = printer;
  return NextResponse.json(safe, { status: 201 });
}
