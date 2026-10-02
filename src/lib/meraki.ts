import { execFile } from "child_process";
import { mapWithConcurrency } from "@/lib/concurrency";
import { ACCESS_POINTS } from "@/config/devices";

const MERAKI_API_BASE = "https://api.meraki.com/api/v1";
const CLIENTS_FETCH_CONCURRENCY = 5;
const PING_CONCURRENCY = 10;
const PING_TIMEOUT_MS = 2000;

export interface AccessPointDTO {
  serial: string;
  name: string;
  model: string;
  status: "online" | "offline" | "dormant" | "alerting" | "unknown";
  tags: string[];
  lanIp: string | null;
  networkId: string | null;
  clientCount: number;
}

interface MerakiDeviceStatus {
  serial: string;
  name?: string;
  model: string;
  status: string;
  productType?: string;
  tags?: string[];
  lanIp?: string | null;
  networkId?: string | null;
}

interface MerakiClient {
  recentDeviceSerial?: string;
}

let cache: { at: number; data: AccessPointDTO[] } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function stripAssetSuffix(name: string): string {
  return name.replace(/_SAP@.*$/i, "");
}

export async function fetchAccessPoints(): Promise<AccessPointDTO[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  try {
    return await fetchAccessPointsFromMeraki();
  } catch (err) {
    const known = cache?.data ?? configuredAccessPoints();
    if (known.length === 0) throw err;
    return pingAccessPoints(known);
  }
}

function configuredAccessPoints(): AccessPointDTO[] {
  return ACCESS_POINTS.map((ap): AccessPointDTO => ({
    serial: ap.ipAddress,
    name: ap.name,
    model: "",
    status: "unknown",
    tags: [],
    lanIp: ap.ipAddress,
    networkId: null,
    clientCount: 0,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchAccessPointsFromMeraki(): Promise<AccessPointDTO[]> {
  const apiKey = process.env.MERAKI_API_KEY;
  const orgId = process.env.MERAKI_ORG_ID;
  if (!apiKey || !orgId) {
    throw new Error("MERAKI_API_KEY / MERAKI_ORG_ID not set in .env");
  }

  const res = await fetch(
    `${MERAKI_API_BASE}/organizations/${orgId}/devices/statuses?perPage=1000`,
    {
      headers: {
        "X-Cisco-Meraki-API-Key": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error(`Meraki API error (${res.status})`);
  }

  const devices: MerakiDeviceStatus[] = await res.json();
  const wirelessDevices = devices.filter((d) => d.productType === "wireless");

  const networkIds = [...new Set(wirelessDevices.map((d) => d.networkId).filter((id): id is string => !!id))];
  const clientsByNetwork = await mapWithConcurrency(
    networkIds,
    CLIENTS_FETCH_CONCURRENCY,
    (networkId) => fetchOnlineClients(networkId, apiKey),
  );

  const clientCountBySerial = new Map<string, number>();
  clientsByNetwork.forEach((result) => {
    if (result.status !== "fulfilled") return;
    for (const client of result.value) {
      if (!client.recentDeviceSerial) continue;
      clientCountBySerial.set(
        client.recentDeviceSerial,
        (clientCountBySerial.get(client.recentDeviceSerial) ?? 0) + 1,
      );
    }
  });

  const accessPoints = wirelessDevices
    .map((d): AccessPointDTO => ({
      serial: d.serial,
      name: stripAssetSuffix(d.name?.trim() || d.serial),
      model: d.model,
      status: (d.status as AccessPointDTO["status"]) ?? "unknown",
      tags: d.tags ?? [],
      lanIp: d.lanIp ?? null,
      networkId: d.networkId ?? null,
      clientCount: clientCountBySerial.get(d.serial) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  cache = { at: Date.now(), data: accessPoints };
  return accessPoints;
}

function ping(host: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Windows ping uses -n instead of -c, and exits 0 even on "Destination
    // host unreachable" — only a reply line (containing "TTL=") means it's up.
    const isWindows = process.platform === "win32";
    const args = isWindows ? ["-n", "1", host] : ["-c", "1", host];
    execFile("ping", args, { timeout: PING_TIMEOUT_MS }, (err, stdout) =>
      resolve(!err && (!isWindows || /TTL=/i.test(stdout))),
    );
  });
}

async function pingAccessPoints(accessPoints: AccessPointDTO[]): Promise<AccessPointDTO[]> {
  const results = await mapWithConcurrency(accessPoints, PING_CONCURRENCY, async (ap) => {
    if (!ap.lanIp) return { ...ap, status: "unknown" as const };
    return { ...ap, status: (await ping(ap.lanIp)) ? ("online" as const) : ("offline" as const) };
  });
  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { ...accessPoints[i], status: "unknown" as const },
  );
}

function nextPageUrl(linkHeader: string | null): string | null {
  const match = linkHeader?.match(/<([^>]+)>;\s*rel=next/);
  return match?.[1] ?? null;
}

async function fetchOnlineClients(networkId: string, apiKey: string): Promise<MerakiClient[]> {
  const clients: MerakiClient[] = [];
  let url: string | null =
    `${MERAKI_API_BASE}/networks/${networkId}/clients?perPage=1000&statuses[]=Online`;

  while (url) {
    const res = await fetch(url, {
      headers: {
        "X-Cisco-Meraki-API-Key": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) break;
    const page = await res.json();
    if (Array.isArray(page)) clients.push(...page);
    url = nextPageUrl(res.headers.get("link"));
  }

  return clients;
}
