import "server-only";
import snmp from "net-snmp";

// Reads a network printer's details over SNMP (standard Host Resources and
// Printer MIBs, supported by HP, Canon, Kyocera, Ricoh, Brother, Xerox, ...).

const OID = {
  sysDescr: "1.3.6.1.2.1.1.1.0",
  sysName: "1.3.6.1.2.1.1.5.0",
  model: "1.3.6.1.2.1.25.3.2.1.3.1", // hrDeviceDescr
  serial: "1.3.6.1.2.1.43.5.1.1.17.1", // prtGeneralSerialNumber
  pageCount: "1.3.6.1.2.1.43.10.2.1.4.1.1", // prtMarkerLifeCount
  supplies: "1.3.6.1.2.1.43.11.1.1", // prtMarkerSuppliesEntry
  colorants: "1.3.6.1.2.1.43.12.1.1.4.1", // prtMarkerColorantValue
  macs: "1.3.6.1.2.1.2.2.1.6", // ifPhysAddress
};

const BRANDS: [RegExp, string][] = [
  [/\b(hp|hewlett[- ]?packard)\b/i, "HP"],
  [/\bcanon\b/i, "Canon"],
  [/\bkyocera\b/i, "Kyocera"],
  [/\bricoh\b/i, "Ricoh"],
  [/\bbrother\b/i, "Brother"],
  [/\bxerox\b/i, "Xerox"],
  [/\bepson\b/i, "Epson"],
  [/\blexmark\b/i, "Lexmark"],
  [/\b(konica|minolta|bizhub)\b/i, "Konica Minolta"],
  [/\bsharp\b/i, "Sharp"],
  [/\btoshiba\b/i, "Toshiba"],
  [/\boki\b/i, "OKI"],
  [/\bsamsung\b/i, "Samsung"],
];

// prtMarkerSuppliesType values worth naming after their colour
const SUPPLY_TYPES: Record<number, string> = { 3: "Toner", 5: "Ink", 6: "Ink", 9: "Drum", 4: "Waste toner" };

export type PrinterInfo = {
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  fields: Record<string, string>; // Hostname, MAC address, Page count, Ink / toner, Cartridges
  supplies: Supply[];
};

/** One ink/toner/drum level; percent is null when the printer only says "some left" (ok) or nothing. */
export type Supply = { name: string; code?: string; colour: string | null; percent: number | null; ok: boolean };

const text = (v: unknown) =>
  (Buffer.isBuffer(v) ? v.toString("utf8") : v == null ? "" : String(v))
    .replace(/\0/g, "")
    .trim();

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** Accepts "10.0.4.21", "printer-2.tasis.ch" or either with ":port". */
export function parseHost(value: string) {
  const m = value.trim().match(/^([a-zA-Z0-9][a-zA-Z0-9.-]{0,252})(?::(\d{1,5}))?$/);
  return m ? { host: m[1], port: m[2] ? Number(m[2]) : 161 } : null;
}

export async function readPrinter(address: string, community = process.env.PRINTER_SNMP_COMMUNITY || "public"): Promise<PrinterInfo> {
  const target = parseHost(address);
  if (!target) throw new Error(`“${address}” is not a valid IP address.`);
  // Most printers answer SNMP v2c; some older ones only v1.
  let raw;
  try {
    raw = await query(target, community, snmp.Version2c);
  } catch {
    raw = await query(target, community, snmp.Version1).catch((e: Error) => {
      throw new Error(
        /timed? ?out/i.test(e.message)
          ? `No answer from ${target.host}. Check the IP, that the printer is on, and that SNMP is enabled on it.`
          : `Couldn't read the printer: ${e.message}`,
      );
    });
  }
  return interpret(raw);
}

type Raw = { basic: Record<string, unknown>; supplies: Record<string, unknown>; colorants: Record<string, unknown>; macs: Record<string, unknown> };

async function query(target: { host: string; port: number }, community: string, version: 0 | 1): Promise<Raw> {
  const session = snmp.createSession(target.host, community, { port: target.port, version, timeout: 2500, retries: 1 });

  const getOne = (oids: string[]) =>
    new Promise<Record<string, unknown>>((resolve, reject) =>
      session.get(oids, (err, vbs) => {
        if (err) reject(err);
        else resolve(Object.fromEntries((vbs ?? []).filter((vb) => !snmp.isVarbindError(vb)).map((vb) => [vb.oid, vb.value])));
      }),
    );
  // In v1 one unknown OID fails the whole request, so ask for each separately
  // (but still fail when the printer doesn't answer at all).
  const get = async (oids: string[]) => {
    if (version === snmp.Version2c) return getOne(oids);
    const first = await getOne([oids[0]]);
    const rest = await Promise.all(oids.slice(1).map((o) => getOne([o]).catch(() => ({}))));
    return Object.assign(first, ...rest);
  };
  // A walk that finds nothing (or isn't supported) just returns an empty result.
  const walk = (oid: string) =>
    new Promise<Record<string, unknown>>((resolve) => {
      const out: Record<string, unknown> = {};
      session.subtree(
        oid,
        20,
        (vbs) => {
          for (const vb of vbs) if (!snmp.isVarbindError(vb)) out[vb.oid.slice(oid.length + 1)] = vb.value;
        },
        () => resolve(out),
      );
    });

  try {
    const basic = await get([OID.sysDescr, OID.sysName, OID.model, OID.serial, OID.pageCount]);
    return { basic, supplies: await walk(OID.supplies), colorants: await walk(OID.colorants), macs: await walk(OID.macs) };
  } finally {
    session.close();
  }
}

function interpret({ basic, supplies, colorants, macs }: Raw): PrinterInfo {
  const descr = text(basic[OID.sysDescr]);
  const model = text(basic[OID.model]) || descr.split(/[;,]/)[0] || null;
  const fields: Record<string, string> = {};
  const hostname = text(basic[OID.sysName]);
  if (hostname) fields["Hostname"] = hostname;
  const mac = Object.values(macs)
    .filter((v): v is Buffer => Buffer.isBuffer(v) && v.length === 6 && v.some((b) => b !== 0))
    .map((v) => [...v].map((b) => b.toString(16).padStart(2, "0")).join(":"))[0];
  if (mac) fields["MAC address"] = mac.toUpperCase();
  const pages = basic[OID.pageCount];
  if (typeof pages === "number") fields["Page count"] = pages.toLocaleString("en-US").replace(/,/g, "'");

  // Supplies table rows are keyed "<column>.1.<index>".
  const cartridges: string[] = [];
  const codes: string[] = [];
  const levels: Supply[] = [];
  let consumable = "";
  for (const key of Object.keys(supplies).filter((k) => k.startsWith("6.1."))) {
    const i = key.slice(4);
    const description = text(supplies[key]);
    const kind = SUPPLY_TYPES[Number(supplies[`5.1.${i}`])];
    const colour = text(colorants[String(supplies[`3.1.${i}`])]);
    const max = Number(supplies[`8.1.${i}`]);
    const level = Number(supplies[`9.1.${i}`]);
    const name = kind && colour && colour !== "unknown" ? `${kind} ${capital(colour)}` : kind && kind !== "Toner" && kind !== "Ink" ? kind : description;
    if (!name) continue;
    // -3 means "some left" and -2 "unknown" in the Printer MIB.
    levels.push({
      name,
      code: kind === "Toner" || kind === "Ink" ? cartridgeCode(description) : undefined,
      colour: colour && colour !== "unknown" ? colour.toLowerCase() : null,
      percent: max > 0 && level >= 0 ? Math.round((level / max) * 100) : null,
      ok: level === -3,
    });
    if (kind === "Toner" || kind === "Ink") {
      cartridges.push(description);
      codes.push(cartridgeCode(description));
      consumable ||= kind;
    }
  }
  if (cartridges.length) {
    fields["Ink / toner"] = `${consumable} – ${[...new Set(codes)].join(" / ")}`;
    fields["Cartridges"] = cartridges.join(" · ");
  }

  return {
    manufacturer: BRANDS.find(([re]) => re.test(`${model} ${descr}`))?.[1] ?? null,
    model,
    serialNumber: text(basic[OID.serial]) || null,
    fields,
    supplies: levels,
  };
}

/**
 * The order code in a supply description: "Black Cartridge HP CF259A" → "CF259A",
 * "Black Ink Supply Unit T13L1/T15R1/T13M1" → "T13L1". Falls back to the description.
 */
function cartridgeCode(description: string) {
  return description.match(/\b(?=[A-Z0-9-]*\d)(?=[A-Z0-9-]*[A-Z])[A-Z0-9-]{3,}\b/)?.[0] ?? description;
}

/** The value of an asset's IP address field ("IP address", "IP", "Indirizzo IP", ...). */
export function ipField(extra: Record<string, string>) {
  const key = Object.keys(extra).find((k) => /^(ip|ip address|ipv4|indirizzo ip|ip addr)$/i.test(k.trim()));
  return key ? extra[key] : null;
}
