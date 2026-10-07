import "server-only";
import type { Asset, Prisma } from "@/generated/prisma";
import { isPrinter, isPrinterField, parseExtra, stringifyExtra, type Readings } from "@/lib/assets";
import { ipField, readPrinter } from "@/lib/printerSnmp";
import { prisma } from "@/lib/prisma";

/**
 * Reads the asset's printer over SNMP and saves what it reports: model and
 * serial into their fields, the rest (ink levels, page count, ...) as
 * read-only readings.
 */
export async function fillFromPrinter(asset: Asset, actorId: string | null) {
  const extra = parseExtra(asset.extra);
  const ip = ipField(extra);
  if (!ip) throw new Error("Add an “IP address” field first.");
  const info = await readPrinter(ip);
  await prisma.asset.update({
    where: { id: asset.id },
    data: {
      manufacturer: info.manufacturer ?? asset.manufacturer,
      model: info.model ?? asset.model,
      serialNumber: info.serialNumber ?? asset.serialNumber,
      // Drop values older versions stored as editable custom fields.
      extra: stringifyExtra(Object.fromEntries(Object.entries(extra).filter(([k]) => !isPrinterField(k)))),
      readings: JSON.stringify({ readAt: new Date().toISOString(), fields: info.fields, supplies: info.supplies } satisfies Readings),
      ...(actorId ? { activity: { create: { actorId, body: `read details from the printer at ${ip}` } } } : {}),
    },
  });
}

/** Re-reads every active printer with an IP (toner levels, page counts) in parallel. */
export async function refreshPrinters(where: Prisma.AssetWhereInput = {}) {
  const assets = (await prisma.asset.findMany({ where: { status: { not: "retired" }, ...where } })).filter(
    (a) => isPrinter(a) && ipField(parseExtra(a.extra)),
  );
  const results = await Promise.allSettled(assets.map((a) => fillFromPrinter(a, null)));
  return { total: assets.length, failed: assets.filter((_, i) => results[i].status === "rejected").map((a) => a.tag) };
}
