import type { Prisma } from "@/generated/prisma";
import type { PrinterFault, Supply } from "@/lib/printerSnmp";
import { prisma } from "@/lib/prisma";

export type AssetFilters = { q: string; status: string; type: string; dept: string; sort: string };

export const ASSET_SORTS: Record<string, Prisma.AssetOrderByWithRelationInput[]> = {
  tag: [{ tag: "asc" }],
  name: [{ name: "asc" }, { tag: "asc" }],
  type: [{ type: "asc" }, { tag: "asc" }],
  status: [{ status: "asc" }, { tag: "asc" }],
  location: [{ location: { name: "asc" } }, { tag: "asc" }],
  assignedTo: [{ assignedTo: "asc" }, { tag: "asc" }],
  manufacturer: [{ manufacturer: "asc" }, { tag: "asc" }],
  model: [{ model: "asc" }, { tag: "asc" }],
  serialNumber: [{ serialNumber: "asc" }, { tag: "asc" }],
  purchaseDate: [{ purchaseDate: "asc" }, { tag: "asc" }],
  warrantyUntil: [{ warrantyUntil: "asc" }, { tag: "asc" }],
  updatedAt: [{ updatedAt: "desc" }],
};

// ---------------------------------------------------------- list columns

/** Asset fields that can be shown as a column (the tag is always first). */
export const FIELD_COLUMNS = {
  name: "Name",
  status: "Status",
  location: "Location",
  assignedTo: "Assigned to",
  manufacturer: "Manufacturer",
  model: "Model",
  serialNumber: "Serial number",
  purchaseDate: "Purchase date",
  warrantyUntil: "Warranty until",
  notes: "Notes",
  updatedAt: "Last changed",
} as const;

export type FieldColumn = keyof typeof FIELD_COLUMNS;
const EXTRA = "extra:";
export const extraColumn = (label: string) => `${EXTRA}${label}`;
/** The custom field label of an "extra:<label>" column key, else null. */
export const extraLabel = (key: string) => (key.startsWith(EXTRA) ? key.slice(EXTRA.length) : null);
// Read-only columns filled by the device: "ink" (level bars) and "reading:<label>".
const READING = "reading:";
export const INK_COLUMN = "ink";
export const readingLabel = (key: string) => (key.startsWith(READING) ? key.slice(READING.length) : null);
export const PRINTER_COLUMNS = [INK_COLUMN, ...["Ink / toner", "Page count", "Cartridges", "Hostname", "MAC address", "Last read"].map((l) => `${READING}${l}`)];
export const isReadOnlyColumn = (key: string) => key === INK_COLUMN || readingLabel(key) !== null;

export const columnLabel = (key: string) =>
  key === INK_COLUMN ? "Ink" : (readingLabel(key) ?? extraLabel(key) ?? FIELD_COLUMNS[key as FieldColumn] ?? key);

/** Fields the printer reader fills in; once a device has been read they can't be edited by hand. */
export const DEVICE_FIELDS = ["manufacturer", "model", "serialNumber"] as const;
export const isDeviceField = (key: string) => (DEVICE_FIELDS as readonly string[]).includes(key);
export const isReadFromDevice = (a: { readings: string | null }) => a.readings !== null;

/** What a device last reported about itself (see lib/printers.ts). */
export type Readings = {
  readAt: string; // last successful read
  fields: Record<string, string>;
  supplies: Supply[];
  // Live state shown on /monitor; missing in readings saved before it existed.
  pageCount?: number | null;
  alert?: PrinterFault | null;
  online?: boolean; // whether the printer answered the last check
  checkedAt?: string; // last check, answered or not
  error?: string; // why the last check failed
};

export function parseReadings(json: string | null | undefined): Readings | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Readings;
  } catch {
    return null;
  }
}

/** Columns of a list with no saved choice: the basics plus its most used custom fields. */
export function defaultColumns(type: string, assets: { extra: string | null }[]) {
  const printer = isPrinter({ type });
  return [
    "name",
    "model",
    "serialNumber",
    "status",
    "location",
    ...(printer ? [] : ["assignedTo"]),
    ...customKeys(type, assets).slice(0, 10).map(extraColumn),
    ...(printer ? [INK_COLUMN, "reading:Page count"] : []),
  ];
}

/** Custom field labels used by a list's items, leaving out what the printer reader owns. */
export function customKeys(type: string, assets: { extra: string | null }[]) {
  const printer = isPrinter({ type });
  return extraKeys(assets).filter((k) => !(printer && isPrinterField(k)));
}

/** Whether items of this list have an "assigned to" person (follows the list's columns). */
export async function hasAssignedTo(departmentId: string, type: string) {
  const saved = await savedColumns(departmentId, type);
  return saved ? saved.includes("assignedTo") : !isPrinter({ type });
}

/** Labels the printer reader used to store as custom fields (now kept in Asset.readings). */
export const isPrinterField = (label: string) =>
  /^(Hostname|MAC address|Page count|Cartridges|Last read|Ink \/ toner|Drum|Waste toner|(Ink|Toner) [A-Z][a-z]+)$/.test(label);

/** The saved columns of a department's list for a type, or null when never customised. */
export async function savedColumns(departmentId: string, type: string): Promise<string[] | null> {
  const list = await prisma.assetList.findUnique({ where: { departmentId_type: { departmentId, type } } });
  if (!list) return null;
  try {
    const cols = JSON.parse(list.columns);
    return Array.isArray(cols) ? cols.filter((c): c is string => typeof c === "string") : null;
  } catch {
    return null;
  }
}

export function readAssetFilters(sp: Record<string, string | string[] | undefined>): AssetFilters {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const sort = get("sort");
  return { q: get("q"), status: get("status"), type: get("type"), dept: get("dept"), sort: sort in ASSET_SORTS ? sort : "tag" };
}

export function assetWhere(f: AssetFilters): Prisma.AssetWhereInput {
  const where: Prisma.AssetWhereInput[] = [];
  if (f.q)
    where.push({
      OR: [
        { tag: { contains: f.q } },
        { name: { contains: f.q } },
        { serialNumber: { contains: f.q } },
        { assignedTo: { contains: f.q } },
        { model: { contains: f.q } },
        { location: { name: { contains: f.q } } },
        { extra: { contains: f.q } },
      ],
    });
  if (f.status === "all") {
    // no status filter
  } else if (f.status) where.push({ status: f.status });
  else where.push({ status: { not: "retired" } });
  if (f.type) where.push({ type: f.type });
  if (f.dept) where.push({ department: { slug: f.dept } });
  return { AND: where };
}

/** Query string for the given filters, dropping empty values. */
export function filterQuery(f: Partial<AssetFilters>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v && !(k === "sort" && v === "tag")) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Printers are shared by a room, so they have no "assigned to" person. */
export const isPrinter = (a: { type?: string | null }) => /printer|copier|mfp|stampante|fotocopiatrice/i.test(a.type ?? "");

// ---------------------------------------------------------- custom fields

export type Extra = Record<string, string>;

export function parseExtra(json: string | null | undefined): Extra {
  if (!json) return {};
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Extra) : {};
  } catch {
    return {};
  }
}

export function stringifyExtra(extra: Extra) {
  const clean = Object.fromEntries(Object.entries(extra).filter(([k, v]) => k.trim() && v.trim()));
  return Object.keys(clean).length ? JSON.stringify(clean) : null;
}

/** Custom field labels across these assets, most used first. */
export function extraKeys(assets: { extra: string | null }[]) {
  const counts = new Map<string, number>();
  for (const a of assets) for (const k of Object.keys(parseExtra(a.extra))) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

/**
 * Custom field labels for an item of this type: the list's custom columns
 * first (in column order), then labels other assets of the type already use.
 */
export async function fieldLabelsFor(type?: string | null, departmentId?: string | null) {
  const [columns, assets] = await Promise.all([
    type && departmentId ? savedColumns(departmentId, type) : null,
    prisma.asset.findMany({
      where: { extra: { not: null }, ...(type ? { type } : {}) },
      select: { extra: true },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
  ]);
  const fromColumns = (columns ?? []).map(extraLabel).filter((l): l is string => !!l);
  // With saved columns, a custom field hidden from the list isn't offered as an empty row.
  return columns ? fromColumns : [...new Set([...fromColumns, ...extraKeys(assets).filter((k) => !(isPrinter({ type }) && isPrinterField(k)))])];
}
