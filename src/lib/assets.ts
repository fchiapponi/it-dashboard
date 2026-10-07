import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type AssetFilters = { q: string; status: string; type: string; dept: string; sort: string };

export const ASSET_SORTS: Record<string, Prisma.AssetOrderByWithRelationInput[]> = {
  tag: [{ tag: "asc" }],
  name: [{ name: "asc" }, { tag: "asc" }],
  type: [{ type: "asc" }, { tag: "asc" }],
  status: [{ status: "asc" }, { tag: "asc" }],
  location: [{ location: { name: "asc" } }, { tag: "asc" }],
  assigned: [{ assignedTo: "asc" }, { tag: "asc" }],
  updated: [{ updatedAt: "desc" }],
};

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

/** Custom field labels already used by assets of this type (or by any asset). */
export async function fieldLabelsFor(type?: string | null) {
  const assets = await prisma.asset.findMany({
    where: { extra: { not: null }, ...(type ? { type } : {}) },
    select: { extra: true },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });
  return extraKeys(assets);
}
