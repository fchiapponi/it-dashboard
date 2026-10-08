import "server-only";
import { inflateRawSync } from "node:zlib";

/** A cell value as stored in the sheet: numbers stay numbers (dates are Excel serials), text stays text. */
export type CellValue = string | number | boolean | null;

/**
 * Minimal .xlsx reader: unzips the file and returns every sheet's cell values
 * (cached formula results included), by sheet name. Enough for reading
 * exported Google Sheets without pulling in a spreadsheet library.
 */
export function readXlsx(buf: Buffer): Map<string, CellValue[][]> {
  const files = unzip(buf);
  const text = (name: string) => {
    const f = files.get(name);
    if (!f) throw new Error(`Not a valid .xlsx file: ${name} is missing`);
    return f.toString("utf8");
  };

  const shared = [...text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => joinText(m[1]));
  const rels = new Map(
    [...text("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((m) => [attr(m[0], "Id"), attr(m[0], "Target")]),
  );

  const sheets = new Map<string, CellValue[][]>();
  for (const m of text("xl/workbook.xml").matchAll(/<sheet\b[^>]*>/g)) {
    const target = rels.get(attr(m[0], "r:id"));
    if (!target) continue;
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    sheets.set(decode(attr(m[0], "name")), readSheet(text(path), shared));
  }
  return sheets;
}

function readSheet(xml: string, shared: string[]): CellValue[][] {
  const rows: CellValue[][] = [];
  for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = attr(m[1], "r");
    const pos = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!pos) continue;
    const body = m[2] ?? "";
    const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
    const type = attr(m[1], "t");
    let value: CellValue = null;
    if (type === "s") value = raw === undefined ? null : (shared[Number(raw)] ?? null);
    else if (type === "inlineStr") value = joinText(body);
    else if (type === "str" || type === "e") value = raw === undefined ? null : decode(raw);
    else if (type === "b") value = raw === "1";
    else if (raw !== undefined) value = Number(raw);
    if (value === null || value === "") continue;
    const row = Number(pos[2]) - 1;
    (rows[row] ??= [])[colIndex(pos[1])] = value;
  }
  // Fill holes so callers can index freely.
  return Array.from(rows, (r) => Array.from(r ?? [], (v) => v ?? null));
}

/** Excel date serial (1900 date system) to "YYYY-MM-DD". */
export function serialToISODate(serial: number) {
  return new Date(Math.round((serial - 25569) * 86400000)).toISOString().slice(0, 10);
}

const colIndex = (letters: string) => [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
const attr = (tag: string, name: string) => decode(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? "");
const joinText = (xml: string) => decode([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
const decode = (s: string) =>
  s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_, e: string) => {
    const named: Record<string, string> = { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" };
    if (named[e.toLowerCase()]) return named[e.toLowerCase()];
    return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  });

/** Reads a zip archive through its central directory. Supports stored and deflated entries. */
function unzip(buf: Buffer) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a valid .xlsx file (no zip directory found)");

  const files = new Map<string, Buffer>();
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Not a valid .xlsx file (broken zip directory)");
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    if (method === 0) files.set(name, data);
    else if (method === 8) files.set(name, inflateRawSync(data));
  }
  return files;
}
