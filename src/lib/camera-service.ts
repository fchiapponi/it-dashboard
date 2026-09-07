import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { probeOnvifCamera, probeTcpReachable } from "@/lib/onvif-camera";
import { mapWithConcurrency } from "@/lib/concurrency";

const POLL_CONCURRENCY = 6;

export async function pollCameraById(cameraId: string) {
  const camera = await prisma.camera.findUniqueOrThrow({ where: { id: cameraId } });
  const password = camera.password ? decryptSecret(camera.password) : undefined;

  if (camera.protocol === "onvif") {
    const result = await probeOnvifCamera({
      host: camera.host,
      port: camera.port,
      username: camera.username ?? undefined,
      password,
    });

    await prisma.camera.update({
      where: { id: camera.id },
      data: {
        status: result.online ? "online" : "error",
        lastSeenAt: result.online ? new Date() : camera.lastSeenAt,
        lastError: result.error ?? null,
        snapshotUrl: result.snapshotUrl ?? camera.snapshotUrl,
      },
    });

    return { status: result.online ? "online" : "error", error: result.error };
  }

  const reachable = await probeTcpReachable(camera.host, camera.port);
  await prisma.camera.update({
    where: { id: camera.id },
    data: {
      status: reachable ? "online" : "offline",
      lastSeenAt: reachable ? new Date() : camera.lastSeenAt,
      lastError: reachable ? null : "Host unreachable",
    },
  });

  return { status: reachable ? "online" : "offline" };
}

export async function pollAllCameras() {
  const cameras = await prisma.camera.findMany({ select: { id: true } });
  const results = await mapWithConcurrency(cameras, POLL_CONCURRENCY, (c) => pollCameraById(c.id));
  return results.map((r, i) => ({
    cameraId: cameras[i].id,
    ok: r.status === "fulfilled",
    error: r.status === "rejected" ? String(r.reason) : undefined,
  }));
}
