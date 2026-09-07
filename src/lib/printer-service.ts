import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { pollPrinter } from "@/lib/snmp-printer";
import { mapWithConcurrency } from "@/lib/concurrency";

const POLL_CONCURRENCY = 6;

export async function pollPrinterById(printerId: string) {
  const printer = await prisma.printer.findUniqueOrThrow({ where: { id: printerId } });
  const community = printer.snmpCommunity ? decryptSecret(printer.snmpCommunity) : "public";

  const result = await pollPrinter(printer.ipAddress, community, printer.snmpVersion === 1 ? 1 : 2);

  const status = result.online ? "online" : "error";

  await prisma.$transaction(async (tx) => {
    await tx.printer.update({
      where: { id: printer.id },
      data: {
        status,
        lastPolledAt: new Date(),
        lastError: result.error ?? null,
      },
    });

    for (const supply of result.supplies) {
      await tx.printerSupply.upsert({
        where: { printerId_name: { printerId: printer.id, name: supply.name } },
        create: {
          printerId: printer.id,
          name: supply.name,
          type: supply.type,
          levelPercent: supply.levelPercent,
          currentLevel: supply.currentLevel,
          maxCapacity: supply.maxCapacity,
          unit: supply.unit,
        },
        update: {
          type: supply.type,
          levelPercent: supply.levelPercent,
          currentLevel: supply.currentLevel,
          maxCapacity: supply.maxCapacity,
          unit: supply.unit,
        },
      });
    }

    if (result.supplies.length > 0) {
      await tx.printerSupply.deleteMany({
        where: {
          printerId: printer.id,
          name: { notIn: result.supplies.map((s) => s.name) },
        },
      });
    }

    if (result.supplies.length) {
      await tx.printerReading.create({
        data: {
          printerId: printer.id,
          status,
          suppliesSnapshot: JSON.stringify(
            result.supplies.map((s) => ({ name: s.name, type: s.type, levelPercent: s.levelPercent })),
          ),
        },
      });
    }
  });

  return { status, error: result.error, suppliesCount: result.supplies.length };
}

export async function pollAllPrinters() {
  const printers = await prisma.printer.findMany({ select: { id: true } });
  const results = await mapWithConcurrency(printers, POLL_CONCURRENCY, (p) => pollPrinterById(p.id));
  return results.map((r, i) => ({
    printerId: printers[i].id,
    ok: r.status === "fulfilled",
    error: r.status === "rejected" ? String(r.reason) : undefined,
  }));
}
