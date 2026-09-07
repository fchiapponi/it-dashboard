import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { PRINTERS, CAMERAS } from "@/config/devices";

// Makes src/config/devices.ts the single source of truth: on every startup,
// the database is reconciled to match it exactly (create/update/delete),
// instead of devices being managed through a settings UI.
export async function syncDevicesFromConfig() {
  for (const p of PRINTERS) {
    await prisma.printer.upsert({
      where: { ipAddress: p.ipAddress },
      create: {
        name: p.name,
        ipAddress: p.ipAddress,
        location: p.location,
        snmpCommunity: encryptSecret(p.snmpCommunity ?? "public"),
        snmpVersion: p.snmpVersion ?? 2,
        model: p.model,
      },
      update: {
        name: p.name,
        location: p.location ?? null,
        snmpCommunity: encryptSecret(p.snmpCommunity ?? "public"),
        snmpVersion: p.snmpVersion ?? 2,
        model: p.model ?? null,
      },
    });
  }
  await prisma.printer.deleteMany({
    where: { ipAddress: { notIn: PRINTERS.map((p) => p.ipAddress) } },
  });

  for (const c of CAMERAS) {
    const port = c.port ?? 80;
    await prisma.camera.upsert({
      where: { host_port: { host: c.host, port } },
      create: {
        name: c.name,
        host: c.host,
        port,
        location: c.location,
        protocol: c.protocol,
        rtspPath: c.rtspPath,
        snapshotUrl: c.snapshotUrl,
        username: c.username,
        password: c.password ? encryptSecret(c.password) : undefined,
      },
      update: {
        name: c.name,
        location: c.location ?? null,
        protocol: c.protocol,
        rtspPath: c.rtspPath ?? null,
        snapshotUrl: c.snapshotUrl ?? null,
        username: c.username ?? null,
        password: c.password ? encryptSecret(c.password) : null,
      },
    });
  }
  const configuredKeys = new Set(CAMERAS.map((c) => `${c.host}:${c.port ?? 80}`));
  const existingCameras = await prisma.camera.findMany({ select: { id: true, host: true, port: true } });
  const staleCameraIds = existingCameras
    .filter((c) => !configuredKeys.has(`${c.host}:${c.port}`))
    .map((c) => c.id);
  if (staleCameraIds.length) {
    await prisma.camera.deleteMany({ where: { id: { in: staleCameraIds } } });
  }
}
