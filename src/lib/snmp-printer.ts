import snmp, { Varbind } from "net-snmp";

// Standard Printer-MIB (RFC 3805) OIDs.
const OID_SYS_DESCR = "1.3.6.1.2.1.1.1.0";
const OID_MARKER_SUPPLIES_TABLE = "1.3.6.1.2.1.43.11.1.1";
const OID_INPUT_TABLE = "1.3.6.1.2.1.43.8.2.1";
const OID_ALERT_TABLE = "1.3.6.1.2.1.43.18.1.1";
// Host Resources MIB (RFC 2790), device index 1 is the printer on every model we have.
const OID_DEVICE_STATUS = "1.3.6.1.2.1.25.3.2.1.5.1";
const OID_DETECTED_ERROR_STATE = "1.3.6.1.2.1.25.3.5.1.2.1";

const DEVICE_STATUS_DOWN = 5;
const ALERT_SEVERITY_CRITICAL = 3;
const ALERT_GROUP_INPUT = 8;
// prtAlertCode values for empty/low ink & toner — already surfaced by the
// supply levels, so they don't count as a fault.
const SUPPLY_LEVEL_ALERT_CODES = new Set([1101, 1102, 1104, 1105]);

// hrPrinterDetectedErrorState bits that mean the printer can't print right
// now. Low paper/toner, near-full output and overdue maintenance are only
// warnings (most of our fleet sits at "low toner" permanently), and no-toner
// is already shown by the supply levels. Bit 0 is the MSB of the first byte.
const FAULT_BITS: { byte: number; mask: number; label: string; paper?: boolean }[] = [
  { byte: 0, mask: 0x40, label: "Out of paper", paper: true },
  { byte: 0, mask: 0x08, label: "Door open" },
  { byte: 0, mask: 0x04, label: "Paper jam" },
  { byte: 0, mask: 0x02, label: "Offline" },
  { byte: 0, mask: 0x01, label: "Service requested" },
  { byte: 1, mask: 0x80, label: "Input tray missing" },
  { byte: 1, mask: 0x40, label: "Output tray missing" },
  { byte: 1, mask: 0x20, label: "Cartridge missing" },
  { byte: 1, mask: 0x08, label: "Output tray full" },
];

// prtMarkerSuppliesType enum (subset)
const SUPPLY_TYPE_MAP: Record<number, { label: string; bucket: string }> = {
  3: { label: "toner", bucket: "toner" },
  4: { label: "waste toner", bucket: "waste" },
  5: { label: "ink", bucket: "ink" },
  6: { label: "waste ink", bucket: "waste" },
  7: { label: "opc/drum", bucket: "drum" },
  8: { label: "developer", bucket: "drum" },
  13: { label: "fuser", bucket: "fuser" },
  18: { label: "transfer unit", bucket: "drum" },
  19: { label: "toner cartridge", bucket: "toner" },
};

// Some printers misreport prtMarkerSuppliesType for their actual ink/toner
// cartridges (e.g. using the "waste ink" code for the real cartridge) — the
// free-text description is more reliable, so it wins when it clearly names
// the supply.
function bucketFromDescription(description: string): string | null {
  const lower = description.toLowerCase();
  if (lower.includes("waste")) return "waste";
  if (lower.includes("ink")) return "ink";
  if (lower.includes("toner")) return "toner";
  if (lower.includes("drum") || lower.includes("opc")) return "drum";
  if (lower.includes("fuser")) return "fuser";
  return null;
}

export interface SupplyReading {
  name: string;
  type: string;
  levelPercent: number | null;
  currentLevel: number | null;
  maxCapacity: number | null;
  unit: string;
}

// Paper problems (out of paper, requested size not loaded) are "warning";
// anything else that stops the printer is "error".
export type AlertLevel = "error" | "warning";

export interface PrinterFault {
  message: string;
  level: AlertLevel;
}

export interface PrinterPollResult {
  online: boolean;
  error?: string;
  // Fault reported by the printer itself (jam, door open, …), null when fine.
  alert: PrinterFault | null;
  supplies: SupplyReading[];
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (Buffer.isBuffer(v)) return Number(v.toString());
  return Number(v);
}

function toText(v: unknown): string {
  if (Buffer.isBuffer(v)) return v.toString("utf8").trim();
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

export async function pollPrinter(
  host: string,
  community: string,
  version: 1 | 2 = 2,
): Promise<PrinterPollResult> {
  const session = snmp.createSession(host, community, {
    version: version === 1 ? snmp.Version1 : snmp.Version2c,
    timeout: 5000,
    retries: 1,
  });

  try {
    await new Promise<void>((resolve, reject) => {
      session.get([OID_SYS_DESCR], (error: Error | null) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const supplies: SupplyReading[] = [];

    const suppliesTable = await tableWalk(session, OID_MARKER_SUPPLIES_TABLE).catch(() => ({}));
    for (const row of Object.values(suppliesTable)) {
      const typeCode = toNumber(row["5"]);
      const description = toText(row["6"]) || SUPPLY_TYPE_MAP[typeCode]?.label || "Supply";
      const maxCapacity = toNumber(row["8"]);
      const level = toNumber(row["9"]);
      const unitCode = toNumber(row["7"]);

      let levelPercent: number | null = null;
      if (unitCode === 19 && level >= 0) {
        // supply unit "percent"
        levelPercent = Math.min(100, Math.max(0, level));
      } else if (maxCapacity > 0 && level >= 0) {
        levelPercent = Math.round((level / maxCapacity) * 100);
      }

      supplies.push({
        name: description,
        type: bucketFromDescription(description) ?? SUPPLY_TYPE_MAP[typeCode]?.bucket ?? "other",
        levelPercent,
        currentLevel: level >= 0 ? level : null,
        maxCapacity: maxCapacity > 0 ? maxCapacity : null,
        unit: unitCode === 19 ? "percent" : "units",
      });
    }

    // A few printers report multiple distinct marker supplies (real, different
    // readings) under the exact same commercial name — disambiguate so none of
    // them get silently dropped by the printerId+name uniqueness constraint.
    const nameOccurrences = new Map<string, number>();
    for (const supply of supplies) {
      nameOccurrences.set(supply.name, (nameOccurrences.get(supply.name) ?? 0) + 1);
    }
    const nameSeen = new Map<string, number>();
    for (const supply of supplies) {
      if ((nameOccurrences.get(supply.name) ?? 0) <= 1) continue;
      const seen = (nameSeen.get(supply.name) ?? 0) + 1;
      nameSeen.set(supply.name, seen);
      supply.name = `${supply.name} (${seen})`;
    }

    const inputTable = await tableWalk(session, OID_INPUT_TABLE).catch(() => ({}));
    let trayIndex = 1;
    for (const row of Object.values(inputTable)) {
      // prtInputCapacityUnit(8), prtInputMaxCapacity(9), prtInputCurrentLevel(10),
      // prtInputMediaName(12), prtInputName(13) — per RFC 3805 prtInputEntry.
      const capacityUnitCode = toNumber(row["8"]);
      const maxCapacity = toNumber(row["9"]);
      const level = toNumber(row["10"]);
      const name = toText(row["13"]) || toText(row["12"]) || `Tray ${trayIndex}`;
      if (maxCapacity <= 0 && level < 0) {
        trayIndex++;
        continue;
      }
      let levelPercent: number | null = null;
      if (capacityUnitCode === 19 && level >= 0) {
        levelPercent = Math.min(100, Math.max(0, level));
      } else if (maxCapacity > 0 && level >= 0) {
        levelPercent = Math.round((level / maxCapacity) * 100);
      }
      supplies.push({
        name,
        type: "paper",
        levelPercent,
        currentLevel: level >= 0 ? level : null,
        maxCapacity: maxCapacity > 0 ? maxCapacity : null,
        unit: capacityUnitCode === 19 ? "percent" : "sheets",
      });
      trayIndex++;
    }

    const alert = await readFault(session).catch(() => null);

    return { online: true, alert, supplies };
  } catch (err) {
    return {
      online: false,
      error: err instanceof Error ? err.message : "Unknown SNMP error",
      alert: null,
      supplies: [],
    };
  } finally {
    session.close();
  }
}

// Prefers the vendor's own text from critical prtAlertTable entries (e.g.
// "Paper jam in Tray 2"), falling back to the generic error-state bits.
// A paper problem also makes the printer report itself offline/down, so
// those don't escalate a paper-only fault to "error".
async function readFault(session: ReturnType<typeof snmp.createSession>): Promise<PrinterFault | null> {
  const alertTable = await tableWalk(session, OID_ALERT_TABLE).catch(() => ({}));
  const descriptions = new Set<string>();
  let allInput = true;
  for (const row of Object.values(alertTable)) {
    // prtAlertSeverityLevel(2), prtAlertGroup(4), prtAlertCode(7), prtAlertDescription(8)
    if (toNumber(row["2"]) !== ALERT_SEVERITY_CRITICAL) continue;
    if (SUPPLY_LEVEL_ALERT_CODES.has(toNumber(row["7"]))) continue;
    const description = toText(row["8"]);
    if (!description) continue;
    descriptions.add(description);
    if (toNumber(row["4"]) !== ALERT_GROUP_INPUT) allInput = false;
  }
  if (descriptions.size) {
    return { message: [...descriptions].join(" · "), level: allInput ? "warning" : "error" };
  }

  const varbinds = await new Promise<Varbind[]>((resolve, reject) => {
    session.get([OID_DETECTED_ERROR_STATE, OID_DEVICE_STATUS], (error: Error | null, vbs?: Varbind[]) => {
      if (error) reject(error);
      else resolve(vbs ?? []);
    });
  });
  const errorState = Buffer.isBuffer(varbinds[0]?.value) ? varbinds[0].value : Buffer.alloc(0);
  const active = FAULT_BITS.filter((b) => ((errorState[b.byte] ?? 0) & b.mask) !== 0);
  if (active.length) {
    const paperOnly = active.some((b) => b.paper) && active.every((b) => b.paper || b.label === "Offline");
    return { message: active.map((b) => b.label).join(" · "), level: paperOnly ? "warning" : "error" };
  }

  if (toNumber(varbinds[1]?.value) === DEVICE_STATUS_DOWN) return { message: "Printer down", level: "error" };
  return null;
}

type TableRow = Record<string, unknown>;

// Rolls our own subtree walk + parse instead of net-snmp's session.table(), which
// only understands single-integer row indices. Printer-MIB tables are indexed by
// {hrDeviceIndex, localIndex} (e.g. suffix "2.1.1" = column 2, row "1.1") — a
// compound index that session.table() silently drops rows for on real devices.
function tableWalk(session: ReturnType<typeof snmp.createSession>, baseOid: string): Promise<Record<string, TableRow>> {
  return new Promise((resolve, reject) => {
    const table: Record<string, TableRow> = {};
    const prefix = baseOid + ".";

    session.subtree(
      baseOid,
      20,
      (varbinds: Varbind[]) => {
        for (const vb of varbinds) {
          if (!vb.oid.startsWith(prefix)) continue;
          const suffix = vb.oid.slice(prefix.length);
          const dotIndex = suffix.indexOf(".");
          if (dotIndex === -1) continue;
          const column = suffix.slice(0, dotIndex);
          const rowIndex = suffix.slice(dotIndex + 1);
          if (!table[rowIndex]) table[rowIndex] = {};
          table[rowIndex][column] = vb.value;
        }
      },
      (error: Error | null) => {
        if (error) reject(error);
        else resolve(table);
      },
    );
  });
}
