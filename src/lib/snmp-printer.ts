import snmp, { Varbind } from "net-snmp";

// Standard Printer-MIB (RFC 3805) OIDs.
const OID_SYS_DESCR = "1.3.6.1.2.1.1.1.0";
const OID_MARKER_SUPPLIES_TABLE = "1.3.6.1.2.1.43.11.1.1";
const OID_INPUT_TABLE = "1.3.6.1.2.1.43.8.2.1";

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

export interface PrinterPollResult {
  online: boolean;
  error?: string;
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

    return { online: true, supplies };
  } catch (err) {
    return {
      online: false,
      error: err instanceof Error ? err.message : "Unknown SNMP error",
      supplies: [],
    };
  } finally {
    session.close();
  }
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
