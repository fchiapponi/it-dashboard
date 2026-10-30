import "server-only";
import { readXlsx } from "@/lib/xlsx";

/**
 * Downloads a Google Sheet shared as "Anyone with the link can view" and
 * returns every tab's cells, by tab name. No Google sign-in needed.
 */
export async function downloadSheet(id: string) {
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=xlsx`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    throw new Error("Google refused to send the sheet. Check that it is shared as “Anyone with the link can view”.");
  }
  if (!res.ok) throw new Error(`Google answered ${res.status}.`);
  return readXlsx(Buffer.from(await res.arrayBuffer()));
}
