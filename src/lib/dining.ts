import "server-only";
import { readXlsx, serialToISODate, type CellValue } from "@/lib/xlsx";

/**
 * Daily meal counts from the kitchen's Google Sheet: one tab per month, one
 * row per day. Columns: A date · B–D De Nobili breakfast/lunch/dinner ·
 * E–F Hadsall lunch/dinner · G–H Focolare lunch/dinner · I–J totals
 * (ignored, recomputed) · K free-text note. A meal cell can hold a word
 * instead of a number ("BRUNCH", "BBQ", ...): that becomes the day's tag.
 */
export type DiningDay = {
  date: string; // YYYY-MM-DD
  dn: { breakfast: number | null; lunch: number | null; dinner: number | null };
  had: { lunch: number | null; dinner: number | null };
  foc: { lunch: number | null; dinner: number | null };
  tag: string;
};

export type DiningData = {
  configured: boolean;
  days: DiningDay[];
  fetchedAt: string | null; // last successful read
  error: string | null; // last read failed (days are then from the previous read)
};

const FIRST_ROW = 3; // 0-based: rows 1–3 are the title and two header rows
const LAST_ROW = 36; // day 31
const TYPO: Record<string, string> = { BUNCH: "BRUNCH", "SPOECIAL DINNER DE NOBILI": "SPECIAL DINNER DE NOBILI", "S.D.": "SPECIAL DINNER" };

function parseWorkbook(buf: Buffer): DiningDay[] {
  const days: DiningDay[] = [];
  for (const rows of readXlsx(buf).values()) {
    for (let r = FIRST_ROW; r <= LAST_ROW; r++) {
      const row = rows[r];
      const dateCell = row?.[0];
      if (typeof dateCell !== "number") continue;
      const cells = row.slice(1, 8);
      const num = (v: CellValue | undefined) => (typeof v === "number" ? Math.round(v) : null);
      const words = [...cells.filter((v): v is string => typeof v === "string"), ...(typeof row[10] === "string" ? [row[10]] : [])];
      const tags: string[] = [];
      for (const w of words) {
        const t = TYPO[w.trim().toUpperCase()] ?? w.trim().toUpperCase();
        if (t && t !== "-" && t !== "NO" && !tags.includes(t)) tags.push(t);
      }
      const day: DiningDay = {
        date: serialToISODate(dateCell),
        dn: { breakfast: num(cells[0]), lunch: num(cells[1]), dinner: num(cells[2]) },
        had: { lunch: num(cells[3]), dinner: num(cells[4]) },
        foc: { lunch: num(cells[5]), dinner: num(cells[6]) },
        tag: tags.join(" · "),
      };
      // Skip days nobody has filled in yet (the sheet pre-fills zeros).
      if (cells.some((v) => typeof v === "number" && v > 0) || day.tag) days.push(day);
    }
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

// Kept on globalThis: instrumentation.ts and the pages load their own copies of
// this module, and the background read must reach the pages.
type Cache = { data: DiningData; at: number; inflight: Promise<DiningData> | null };
const cache = ((globalThis as typeof globalThis & { __diningCache?: Cache }).__diningCache ??= {
  data: { configured: false, days: [], fetchedAt: null, error: null },
  at: 0,
  inflight: null,
});

/** After a failed read, pages try Google again this soon instead of waiting for the next scheduled read. */
const RETRY_MS = 5 * 60_000;

async function load(): Promise<DiningData> {
  const id = process.env.DINING_SHEET_ID;
  if (!id) return { configured: false, days: [], fetchedAt: null, error: null };
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=xlsx`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new Error("Google refused to send the sheet. Check that it is shared as “Anyone with the link can view”.");
    }
    if (!res.ok) throw new Error(`Google answered ${res.status}.`);
    const days = parseWorkbook(Buffer.from(await res.arrayBuffer()));
    return { configured: true, days, fetchedAt: new Date().toISOString(), error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[dining]", message);
    return { ...cache.data, configured: true, error: message };
  }
}

/** How often the sheet is re-read in the background (DINING_REFRESH_HOURS, default 6). */
export const diningRefreshMs = () => Math.max(0.25, Number(process.env.DINING_REFRESH_HOURS) || 6) * 3_600_000;

/**
 * The sheet's days, from the last read. Reads Google when nothing has been
 * read yet, when the last read is older than the refresh interval (5 minutes
 * after a failed read), or when force is set. A failed read keeps the last
 * good data.
 */
export async function getDiningData(force = false): Promise<DiningData> {
  const maxAge = cache.data.error ? RETRY_MS : diningRefreshMs();
  if (!force && cache.at && Date.now() - cache.at < maxAge) return cache.data;
  cache.inflight ??= load().finally(() => (cache.inflight = null));
  const data = await cache.inflight;
  cache.data = data;
  cache.at = Date.now();
  return data;
}
