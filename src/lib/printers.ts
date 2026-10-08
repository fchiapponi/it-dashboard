import "server-only";
import type { Asset, Prisma } from "@/generated/prisma";
import { isPrinter, isPrinterField, parseExtra, parseReadings, stringifyExtra, type Readings } from "@/lib/assets";
import { ipField, readPrinter } from "@/lib/printerSnmp";
import { prisma } from "@/lib/prisma";

/**
 * Reads the asset's printer over SNMP and saves what it reports: model and
 * serial into their fields, the rest (ink levels, page count, faults, ...) as
 * read-only readings. A printer that doesn't answer is marked offline.
 */
export async function fillFromPrinter(asset: Asset, actorId: string | null) {
  const extra = parseExtra(asset.extra);
  const ip = ipField(extra);
  if (!ip) throw new Error("Add an “IP address” field first.");
  const now = new Date().toISOString();
  let info;
  try {
    info = await readPrinter(ip);
  } catch (e) {
    // Keep the last levels; /monitor hides them while the printer is offline.
    const previous = parseReadings(asset.readings);
    if (previous) {
      const error = e instanceof Error ? e.message : String(e);
      await saveReadings(asset.id, { ...previous, online: false, alert: null, checkedAt: now, error });
    }
    throw e;
  }

  const readings: Readings = {
    readAt: now,
    fields: info.fields,
    supplies: info.supplies,
    pageCount: info.pageCount,
    alert: info.alert,
    online: true,
    checkedAt: now,
  };
  // Drop values older versions stored as editable custom fields.
  const cleanExtra = stringifyExtra(Object.fromEntries(Object.entries(extra).filter(([k]) => !isPrinterField(k))));
  const manufacturer = info.manufacturer ?? asset.manufacturer;
  const model = info.model ?? asset.model;
  const serialNumber = info.serialNumber ?? asset.serialNumber;
  const unchanged =
    manufacturer === asset.manufacturer && model === asset.model && serialNumber === asset.serialNumber && cleanExtra === asset.extra;
  if (unchanged && !actorId) return saveReadings(asset.id, readings);

  await prisma.asset.update({
    where: { id: asset.id },
    data: {
      manufacturer,
      model,
      serialNumber,
      extra: cleanExtra,
      readings: JSON.stringify(readings),
      ...(actorId ? { activity: { create: { actorId, body: `read details from the printer at ${ip}` } } } : {}),
    },
  });
}

/**
 * Saves only the readings, leaving "Last changed" alone: printers are checked
 * every few minutes and that shouldn't count as someone changing the item.
 */
async function saveReadings(assetId: string, readings: Readings) {
  await prisma.$executeRaw`UPDATE "Asset" SET "readings" = ${JSON.stringify(readings)} WHERE "id" = ${assetId}`;
}

/** Re-reads every active printer with an IP (status, toner levels, page counts) in parallel. */
export async function refreshPrinters(where: Prisma.AssetWhereInput = {}) {
  const assets = (await prisma.asset.findMany({ where: { status: { not: "retired" }, ...where } })).filter(
    (a) => isPrinter(a) && ipField(parseExtra(a.extra)),
  );
  const results = await Promise.allSettled(assets.map((a) => fillFromPrinter(a, null)));
  return { total: assets.length, failed: assets.filter((_, i) => results[i].status === "rejected").map((a) => a.tag) };
}
