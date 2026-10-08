import { NextResponse } from "next/server";
import { isPrinter, parseExtra, parseReadings } from "@/lib/assets";
import { getUser } from "@/lib/auth";
import { ipField, kindFromDescription } from "@/lib/printerSnmp";
import { prisma } from "@/lib/prisma";
import type { PrinterDTO } from "@/lib/types";

// The printers on /monitor are the inventory's printers (any department) that
// have an IP address; lib/printers.ts reads them on a timer.
export async function GET() {
  if (!(await getUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const assets = await prisma.asset.findMany({
    where: { status: { not: "retired" } },
    include: { location: true },
    orderBy: { name: "asc" },
  });

  const printers = assets.flatMap((a): PrinterDTO[] => {
    const ip = isPrinter(a) ? ipField(parseExtra(a.extra)) : null;
    if (!ip) return [];
    const r = parseReadings(a.readings);
    return [
      {
        id: a.id,
        // Inventory names read "Library printer"; the screen's cards are small.
        name: a.name.replace(/\s+printer$/i, ""),
        location: a.location?.name ?? null,
        ipAddress: ip,
        model: a.model,
        // Readings saved before the online flag existed came from a successful read.
        status: !r ? "unknown" : r.online === false ? "error" : "online",
        lastPolledAt: r?.checkedAt ?? r?.readAt ?? null,
        lastError: r?.error ?? null,
        alert: r?.alert?.message ?? null,
        alertLevel: r?.alert?.level ?? null,
        pageCount: r?.pageCount ?? (Number(r?.fields["Page count"]?.replace(/\D/g, "")) || null),
        supplies: (r?.supplies ?? []).map((s, i) => ({
          id: `${a.id}:${i}`,
          name: s.code && s.code !== s.name ? `${s.name} ${s.code}` : s.name,
          type: s.kind ?? kindFromDescription(s.name) ?? "other",
          levelPercent: s.percent,
          currentLevel: null,
          maxCapacity: null,
          unit: "percent",
        })),
      },
    ];
  });

  return NextResponse.json(printers);
}
