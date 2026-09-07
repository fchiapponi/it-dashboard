const MERAKI_API_BASE = "https://api.meraki.com/api/v1";

export interface AccessPointDTO {
  serial: string;
  name: string;
  model: string;
  status: "online" | "offline" | "dormant" | "alerting" | "unknown";
  tags: string[];
  lanIp: string | null;
  networkId: string | null;
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

let cache: { at: number; data: AccessPointDTO[] } | null = null;
const CACHE_TTL_MS = 20000;

function stripAssetSuffix(name: string): string {
  return name.replace(/_SAP@.*$/i, "");
}

export async function fetchAccessPoints(): Promise<AccessPointDTO[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

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
  const accessPoints = devices
    .filter((d) => d.productType === "wireless")
    .map((d): AccessPointDTO => ({
      serial: d.serial,
      name: stripAssetSuffix(d.name?.trim() || d.serial),
      model: d.model,
      status: (d.status as AccessPointDTO["status"]) ?? "unknown",
      tags: d.tags ?? [],
      lanIp: d.lanIp ?? null,
      networkId: d.networkId ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  cache = { at: Date.now(), data: accessPoints };
  return accessPoints;
}
