import { prisma } from "@/lib/prisma";
import { probeServerReachable } from "@/lib/server-probe";
import { mapWithConcurrency } from "@/lib/concurrency";

const POLL_CONCURRENCY = 6;

export async function pollServerById(serverId: string) {
  const server = await prisma.server.findUniqueOrThrow({ where: { id: serverId } });
  const reachable = await probeServerReachable(server.ipAddress);

  await prisma.server.update({
    where: { id: server.id },
    data: {
      status: reachable ? "online" : "offline",
      lastSeenAt: reachable ? new Date() : server.lastSeenAt,
      lastError: reachable ? null : "Host unreachable",
    },
  });

  return { status: reachable ? "online" : "offline" };
}

export async function pollAllServers() {
  const servers = await prisma.server.findMany({ select: { id: true } });
  const results = await mapWithConcurrency(servers, POLL_CONCURRENCY, (s) => pollServerById(s.id));
  return results.map((r, i) => ({
    serverId: servers[i].id,
    ok: r.status === "fulfilled",
    error: r.status === "rejected" ? String(r.reason) : undefined,
  }));
}
