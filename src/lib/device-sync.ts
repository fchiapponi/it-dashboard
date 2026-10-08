import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { CAMERAS, SERVERS } from "@/config/devices";

// Makes src/config/devices.ts the single source of truth: on every startup,
// the database is reconciled to match it exactly (create/update/delete),
// instead of devices being managed through a settings UI. Printers are not
// here: they are items in the inventory (see lib/printers.ts).
export async function syncDevicesFromConfig() {
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

  for (const s of SERVERS) {
    await prisma.server.upsert({
      where: { ipAddress: s.ipAddress },
      create: { name: s.name, ipAddress: s.ipAddress },
      update: { name: s.name },
    });
  }
  await prisma.server.deleteMany({
    where: { ipAddress: { notIn: SERVERS.map((s) => s.ipAddress) } },
  });
}
