import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().optional(),
  ipAddress: z.string().min(1).optional(),
  snmpCommunity: z.string().optional(),
  snmpVersion: z.union([z.literal(1), z.literal(2)]).optional(),
  model: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const printer = await prisma.printer.findUnique({
    where: { id },
    include: { supplies: true, readings: { orderBy: { timestamp: "desc" }, take: 50 } },
  });
  if (!printer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { snmpCommunity: _snmpCommunity, ...safe } = printer;
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
  if (data.snmpCommunity) {
    data.snmpCommunity = encryptSecret(data.snmpCommunity);
  }
  const printer = await prisma.printer.update({ where: { id }, data });
  const { snmpCommunity: _snmpCommunity, ...safe } = printer;
  return NextResponse.json(safe);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.printer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
