import "server-only";
import { downloadSheet } from "@/lib/sheets";
import type { CellValue } from "@/lib/xlsx";

/**
 * The kitchen's articles, from its inventory Google Sheet: one tab per
 * category (Plates, Cutlery, ...), a header row, then one row per article.
 * The header has an article column ("Article", "Articolo", "Item" or
 * "Name"), one column per dining hall (De Nobili, Hadsall, Focolare) with how
 * many of that article each hall uses, and any other columns (Unit, Code,
 * Notes, ...), shown as they are. A total column is ignored and recomputed.
 */
export const HALLS = [
  { id: "dn", name: "De Nobili", match: /nobili/i },
  { id: "had", name: "Hadsall", match: /hadsall/i },
  { id: "foc", name: "Focolare", match: /focolare/i },
] as const;
export type HallId = (typeof HALLS)[number]["id"];

/** A hall's cell: a count, or text typed instead ("on request", ...). */
export type HallQuantity = number | string | null;

export type KitchenArticle = {
  name: string;
  halls: Record<HallId, HallQuantity>;
  extra: string[]; // values of the category's other columns, in order
};

export type KitchenCategory = { name: string; columns: string[]; articles: KitchenArticle[] };

export type KitchenInventory = {
  configured: boolean;
  categories: KitchenCategory[];
  fetchedAt: string | null; // last successful read
  error: string | null; // last read failed (categories are then from the previous read)
};

const ARTICLE = /^(artic|item|nome|name|descr)/i;
const TOTAL = /^(tot|total|totale)$/i;
const HEADER_ROWS = 10; // the header is looked for in the first rows only, under any title

const text = (v: CellValue | undefined) => (v === null || v === undefined ? "" : String(v).trim());

function parseTab(name: string, rows: CellValue[][]): KitchenCategory | null {
  const header = rows.slice(0, HEADER_ROWS).findIndex((r) => r?.some((v) => HALLS.some((h) => h.match.test(text(v)))));
  if (header < 0) return null;
  const head = rows[header].map(text);
  const hallCol = Object.fromEntries(HALLS.map((h) => [h.id, head.findIndex((v) => h.match.test(v))])) as Record<HallId, number>;
  const taken = new Set(Object.values(hallCol));
  let articleCol = head.findIndex((v, i) => !taken.has(i) && ARTICLE.test(v));
  if (articleCol < 0) articleCol = head.findIndex((v, i) => !taken.has(i) && v);
  if (articleCol < 0) return null;
  const extraCols = head.flatMap((v, i) => (v && i !== articleCol && !taken.has(i) && !TOTAL.test(v) ? [i] : []));

  const articles: KitchenArticle[] = [];
  for (const row of rows.slice(header + 1)) {
    const article = text(row?.[articleCol]);
    if (!article) continue;
    const qty = (i: number): HallQuantity => {
      const v = i < 0 ? null : row[i];
      return typeof v === "number" ? v : text(v) || null;
    };
    articles.push({
      name: article,
      halls: Object.fromEntries(HALLS.map((h) => [h.id, qty(hallCol[h.id])])) as Record<HallId, HallQuantity>,
      extra: extraCols.map((i) => text(row[i])),
    });
  }
  return { name, columns: extraCols.map((i) => head[i]), articles };
}

// Kept on globalThis: instrumentation.ts and the pages load their own copies of
// this module, and the background read must reach the pages.
type Cache = { data: KitchenInventory; at: number; inflight: Promise<KitchenInventory> | null };
const cache = ((globalThis as typeof globalThis & { __kitchenInventoryCache?: Cache }).__kitchenInventoryCache ??= {
  data: { configured: false, categories: [], fetchedAt: null, error: null },
  at: 0,
  inflight: null,
});

/** After a failed read, pages try Google again this soon instead of waiting for the next scheduled read. */
const RETRY_MS = 5 * 60_000;

async function load(): Promise<KitchenInventory> {
  const id = process.env.KITCHEN_INVENTORY_SHEET_ID;
  if (!id) return { configured: false, categories: [], fetchedAt: null, error: null };
  try {
    const tabs = await downloadSheet(id);
    const categories = [...tabs].flatMap(([name, rows]) => parseTab(name, rows) ?? []);
    if (tabs.size && !categories.length) throw new Error("No tab has a header row with De Nobili, Hadsall or Focolare.");
    return { configured: true, categories, fetchedAt: new Date().toISOString(), error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[kitchen-inventory]", message);
    return { ...cache.data, configured: true, error: message };
  }
}

/** How often the sheet is re-read in the background (KITCHEN_INVENTORY_REFRESH_HOURS, default 6). */
export const kitchenInventoryRefreshMs = () => Math.max(0.25, Number(process.env.KITCHEN_INVENTORY_REFRESH_HOURS) || 6) * 3_600_000;

/**
 * The sheet's articles, from the last read. Reads Google when nothing has been
 * read yet, when the last read is older than the refresh interval (5 minutes
 * after a failed read), or when force is set. A failed read keeps the last
 * good data.
 */
export async function getKitchenInventory(force = false): Promise<KitchenInventory> {
  const maxAge = cache.data.error ? RETRY_MS : kitchenInventoryRefreshMs();
  if (!force && cache.at && Date.now() - cache.at < maxAge) return cache.data;
  cache.inflight ??= load().finally(() => (cache.inflight = null));
  const data = await cache.inflight;
  cache.data = data;
  cache.at = Date.now();
  return data;
}
