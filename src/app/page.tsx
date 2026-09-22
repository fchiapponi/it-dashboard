"use client";

import type { CSSProperties } from "react";
import { Printer, Video, Wifi, Server, AlertTriangle, TerminalSquare, Users, Pin } from "lucide-react";
import { usePrinters, useCameras, useAccessPoints, useServers } from "@/lib/hooks";
import { StatTile } from "@/components/ui/StatTile";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { StatusBadge, statusColor, type Status } from "@/components/ui/StatusBadge";
import { Clock } from "@/components/layout/Clock";
import { Countdowns } from "@/components/layout/Countdowns";

const LOW_SUPPLY_THRESHOLD = 2;

const INK_LABELS: Record<string, string> = {
  black: "K",
  cyan: "C",
  magenta: "M",
  yellow: "Y",
};

const TYPE_LABELS: Record<string, string> = {
  paper: "Paper",
  drum: "Drum",
  waste: "Waste",
  fuser: "Fuser",
};

// The dot/label next to each supply shows what it physically is (its real
// ink color), not how full it is — the chip's red outline already covers
// "this needs attention".
const SWATCH_COLORS: Record<string, string> = {
  K: "#e2e8f0",
  C: "#22e8e0",
  M: "#f472b6",
  Y: "#facc15",
};

function swatchColor(label: string): string {
  return SWATCH_COLORS[label] ?? "var(--text-dim)";
}

function chipStyle(status: Status): CSSProperties {
  if (status === "online" || status === "unknown") return {};
  const color = statusColor(status);
  return { borderColor: color, boxShadow: `inset 0 0 0 1px ${color}, 0 0 10px -2px ${color}` };
}

function sortProblemsFirst<T extends { status: Status }>(items: T[] | undefined): T[] {
  if (!items) return [];
  return [...items].sort((a, b) => {
    const aOk = a.status === "online" ? 1 : 0;
    const bOk = b.status === "online" ? 1 : 0;
    return aOk - bOk;
  });
}

function sortProblemsFirstThenByClients<T extends { status: Status; clientCount: number }>(
  items: T[] | undefined,
): T[] {
  if (!items) return [];
  return [...items].sort((a, b) => {
    const aOk = a.status === "online" ? 1 : 0;
    const bOk = b.status === "online" ? 1 : 0;
    if (aOk !== bOk) return aOk - bOk;
    return b.clientCount - a.clientCount;
  });
}

function isTonerLike(supply: { type: string }): boolean {
  return supply.type === "ink" || supply.type === "toner";
}

type SupplyLike = { type: string; levelPercent: number | null };

function minTonerPercent(printer: { supplies: SupplyLike[] }): number {
  const levels = printer.supplies
    .filter(isTonerLike)
    .map((s) => s.levelPercent)
    .filter((v): v is number => v !== null);
  return levels.length ? Math.min(...levels) : Infinity;
}

// Printers always kept at the top of the panel, ahead of the urgency sort.
const PINNED_PRINTERS = new Set([
  "De Nobili Faculty",
  "Hadsall Faculty",
  "Monticello Faculty",
  "Aurora",
  "Focolare",
]);

// Pinned printers first, then offline/error printers, then online ones
// ordered by their lowest remaining ink/toner level (most urgent first).
function sortPrintersByUrgency<T extends { name: string; status: Status; supplies: SupplyLike[] }>(
  printers: T[] | undefined,
): T[] {
  if (!printers) return [];
  return [...printers].sort((a, b) => {
    const aPinned = PINNED_PRINTERS.has(a.name) ? 0 : 1;
    const bPinned = PINNED_PRINTERS.has(b.name) ? 0 : 1;
    if (aPinned !== bPinned) return aPinned - bPinned;
    const aOffline = a.status !== "online" ? 0 : 1;
    const bOffline = b.status !== "online" ? 0 : 1;
    if (aOffline !== bOffline) return aOffline - bOffline;
    return minTonerPercent(a) - minTonerPercent(b);
  });
}

// Printers that failed to respond to polling are shown as neutral gray
// (disconnected) rather than red — red is reserved for online printers that
// need attention (empty/low supplies).
const PRINTER_OFFLINE_COLOR = "var(--gray)";

// Same as chipStyle, but also flags online printers that are dangerously low
// on ink/toner — not just ones that are outright unreachable. Empty (0%) is
// red; anything else under the threshold is amber.
function printerChipStyle(printer: { status: Status; supplies: SupplyLike[] }): CSSProperties {
  if (printer.status === "online") {
    const minPercent = minTonerPercent(printer);
    if (minPercent <= 0) {
      const color = statusColor("error");
      return { borderColor: color, boxShadow: `inset 0 0 0 1px ${color}, 0 0 10px -2px ${color}` };
    }
    if (minPercent < LOW_SUPPLY_THRESHOLD) {
      const color = statusColor("warning");
      return { borderColor: color, boxShadow: `inset 0 0 0 1px ${color}, 0 0 10px -2px ${color}` };
    }
    return {};
  }
  if (printer.status === "error") {
    return {
      borderColor: PRINTER_OFFLINE_COLOR,
      boxShadow: `inset 0 0 0 1px ${PRINTER_OFFLINE_COLOR}, 0 0 10px -2px ${PRINTER_OFFLINE_COLOR}`,
    };
  }
  return chipStyle(printer.status);
}

function supplyShortLabel(supply: { name: string; type: string }): string {
  const lower = supply.name.toLowerCase();
  if (supply.type === "ink" || supply.type === "toner") {
    const match = Object.keys(INK_LABELS).find((color) => lower.includes(color));
    if (match) return INK_LABELS[match];
  }
  return TYPE_LABELS[supply.type] ?? supply.name.slice(0, 3).toUpperCase();
}

export default function TvDashboardPage() {
  const { data: printers } = usePrinters();
  const { data: cameras } = useCameras();
  const { data: accessPoints } = useAccessPoints();
  const { data: servers } = useServers();

  const printersOnline = printers?.filter((p) => p.status === "online").length ?? 0;
  const camerasOnline = cameras?.filter((c) => c.status === "online").length ?? 0;
  const apsOnline = accessPoints?.filter((a) => a.status === "online").length ?? 0;
  const totalClients = accessPoints?.reduce((sum, a) => sum + a.clientCount, 0) ?? 0;
  const serversOnline = servers?.filter((s) => s.status === "online").length ?? 0;

  const sortedPrinters = sortPrintersByUrgency(printers);
  const pinnedPrinters = sortedPrinters.filter((p) => PINNED_PRINTERS.has(p.name));
  const restPrinters = sortedPrinters.filter((p) => !PINNED_PRINTERS.has(p.name));
  const offlinePrinters = restPrinters.filter((p) => p.status !== "online");
  const onlinePrinters = restPrinters.filter((p) => p.status === "online");
  const sortedAccessPoints = sortProblemsFirstThenByClients(accessPoints);
  const sortedServers = sortProblemsFirst(servers);
  const sortedCameras = sortProblemsFirst(cameras);

  function renderPrinterCard(p: (typeof sortedPrinters)[number]) {
    const tonerSupplies = p.status === "online" ? p.supplies.filter(isTonerLike) : [];
    const baseLabelCounts = tonerSupplies.reduce<Record<string, number>>((acc, s) => {
      const base = supplyShortLabel(s);
      acc[base] = (acc[base] ?? 0) + 1;
      return acc;
    }, {});
    const baseLabelSeen: Record<string, number> = {};
    return (
      <div key={p.id} className="glass-chip rounded-[0.25rem] px-2 py-1.5" style={printerChipStyle(p)}>
        <div className="flex items-center justify-between gap-1.5">
          <span className="flex min-w-0 items-center gap-1 truncate text-[0.6875rem] font-bold text-[var(--text-primary)]">
            {PINNED_PRINTERS.has(p.name) && (
              <Pin className="h-2.5 w-2.5 shrink-0 text-[var(--accent)]" />
            )}
            <span className="truncate">{p.name}</span>
          </span>
          <StatusBadge
            status={p.status}
            hideLabel
            className="shrink-0"
            colorOverride={p.status === "error" ? PRINTER_OFFLINE_COLOR : undefined}
          />
        </div>
        {tonerSupplies.length > 0 && (
          <div className="no-scrollbar mt-1.5 flex flex-nowrap gap-x-2.5 overflow-x-auto">
            {tonerSupplies.map((s) => {
              const base = supplyShortLabel(s);
              const color = swatchColor(base);
              baseLabelSeen[base] = (baseLabelSeen[base] ?? 0) + 1;
              const label = baseLabelCounts[base] > 1 ? `${base}${baseLabelSeen[base]}` : base;
              return (
                <span
                  key={s.id}
                  title={s.name}
                  className="flex shrink-0 items-center gap-1 text-[0.625rem] tabular-nums"
                  style={{ color }}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: color, boxShadow: `0 0 4px ${color}` }}
                  />
                  {label} {s.levelPercent === null ? "N/A" : `${s.levelPercent}%`}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const printersWithLowSupply =
    printers?.filter((p) =>
      p.supplies.some(
        (s) => isTonerLike(s) && s.levelPercent !== null && s.levelPercent > 0 && s.levelPercent < LOW_SUPPLY_THRESHOLD,
      ),
    ) ?? [];
  const printersWithEmptySupply =
    printers?.filter((p) => p.supplies.some((s) => isTonerLike(s) && s.levelPercent === 0)) ?? [];

  return (
    <div className="relative flex h-dvh w-full flex-col gap-3 overflow-hidden bg-[var(--bg)] p-4">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 -top-32 h-96 w-96 rounded-full bg-[var(--accent)]/20 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-[var(--cyan)]/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[var(--amber)]/10 blur-[120px]" />
      </div>

      <header className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TerminalSquare className="h-5 w-5 text-[var(--accent)]" />
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-[0.15em] text-[var(--accent)] glow-text">
              TASIS
            </div>
            <div className="text-[0.5rem] tracking-[0.3em] text-[var(--text-faint)]">CONTROL ROOM</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Countdowns />
          <Clock />
        </div>
      </header>

      <div className="grid grid-cols-7 gap-3">
        <StatTile
          label="Access points online"
          value={`${apsOnline}/${accessPoints?.length ?? 0}`}
          icon={<Wifi className="h-4 w-4" />}
          tone="cyan"
        />
        <StatTile
          label="Clients connected"
          value={totalClients}
          icon={<Users className="h-4 w-4" />}
          tone="cyan"
        />
        <StatTile
          label="Printers online"
          value={`${printersOnline}/${printers?.length ?? 0}`}
          icon={<Printer className="h-4 w-4" />}
          tone="accent"
        />
        <StatTile
          label="Supply low"
          value={printersWithLowSupply.length}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={printersWithLowSupply.length ? "amber" : "accent"}
        />
        <StatTile
          label="Supply empty"
          value={printersWithEmptySupply.length}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={printersWithEmptySupply.length ? "red" : "accent"}
        />
        <StatTile
          label="Cameras online"
          value={`${camerasOnline}/${cameras?.length ?? 0}`}
          icon={<Video className="h-4 w-4" />}
          tone="cyan"
        />
        <StatTile
          label="Servers online"
          value={`${serversOnline}/${servers?.length ?? 0}`}
          icon={<Server className="h-4 w-4" />}
          tone="accent"
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1.2fr_1.2fr_0.7fr] gap-3">
        <TerminalPanel
          title={`access points (${accessPoints?.length ?? 0})`}
          bodyClassName="overflow-hidden p-0"
        >
          <div
            className="no-scrollbar grid h-full content-start gap-0.5 overflow-y-auto p-1"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(7rem, 1fr))" }}
          >
            {!accessPoints?.length && (
              <p className="text-xs text-[var(--text-dim)]">No access points found.</p>
            )}
            {sortedAccessPoints.map((a) => (
              <div
                key={a.serial}
                title={a.model}
                className="glass-chip rounded-[0.25rem] px-1 py-0.5"
                style={chipStyle(a.status)}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="shrink-0 text-[0.5rem] text-[var(--text-dim)]">{a.clientCount}</span>
                  <span className="truncate text-[0.5rem] text-[var(--text-primary)]">{a.name}</span>
                  <StatusBadge status={a.status} hideLabel className="shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </TerminalPanel>

        <TerminalPanel
          title={`printers (${printers?.length ?? 0})`}
          bodyClassName="overflow-hidden p-0"
        >
          <div className="no-scrollbar flex h-full flex-col gap-1.5 overflow-y-auto p-2">
            {!printers?.length && (
              <p className="text-xs text-[var(--text-dim)]">No printers configured.</p>
            )}
            {pinnedPrinters.length > 0 && (
              <>
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(13rem, 1fr))" }}
                >
                  {pinnedPrinters.map((p) => renderPrinterCard(p))}
                </div>
                {restPrinters.length > 0 && (
                  <div className="my-0.5 border-t border-[var(--border)]" />
                )}
              </>
            )}
            {offlinePrinters.length > 0 && (
              <>
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(13rem, 1fr))" }}
                >
                  {offlinePrinters.map((p) => renderPrinterCard(p))}
                </div>
                {onlinePrinters.length > 0 && (
                  <div className="my-0.5 border-t border-[var(--border)]" />
                )}
              </>
            )}
            {onlinePrinters.length > 0 && (
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(13rem, 1fr))" }}
              >
                {onlinePrinters.map((p) => renderPrinterCard(p))}
              </div>
            )}
          </div>
        </TerminalPanel>

        <div className="grid min-h-0 gap-3" style={{ gridTemplateRows: "auto 1fr" }}>
          <TerminalPanel
            title={`servers (${servers?.length ?? 0})`}
            className="h-auto"
            bodyClassName="overflow-hidden p-0"
          >
            <div
              className="no-scrollbar grid content-start gap-0.5 overflow-y-auto p-1"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))" }}
            >
              {!sortedServers.length && (
                <p className="text-xs text-[var(--text-dim)]">No servers configured.</p>
              )}
              {sortedServers.map((s) => (
                <div
                  key={s.id}
                  title={s.ipAddress}
                  className="glass-chip rounded-[0.25rem] px-1 py-0.5"
                  style={chipStyle(s.status)}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[0.5rem] text-[var(--text-primary)]">{s.name}</span>
                    <StatusBadge status={s.status} hideLabel className="shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </TerminalPanel>

          <TerminalPanel
            title={`cameras (${cameras?.length ?? 0})`}
            bodyClassName="overflow-hidden p-0"
          >
            <div
              className="no-scrollbar grid h-full content-start gap-0.5 overflow-y-auto p-1"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(7rem, 1fr))" }}
            >
              {!sortedCameras.length && (
                <p className="text-xs text-[var(--text-dim)]">No cameras configured.</p>
              )}
              {sortedCameras.map((c) => (
                <div
                  key={c.id}
                  className="glass-chip rounded-[0.25rem] px-1 py-0.5"
                  style={chipStyle(c.status)}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[0.5rem] text-[var(--text-primary)]">{c.name}</span>
                    <StatusBadge status={c.status} hideLabel className="shrink-0" />
                  </div>
                  {c.location && (
                    <div className="mt-0.5 truncate text-[0.5rem] text-[var(--text-faint)]">{c.location}</div>
                  )}
                </div>
              ))}
            </div>
          </TerminalPanel>
        </div>
      </div>
    </div>
  );
}
