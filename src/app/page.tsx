"use client";

import { useEffect, type CSSProperties } from "react";
import { Printer, Video, Wifi, Server, AlertTriangle, TerminalSquare } from "lucide-react";
import { usePrinters, useCameras, useAccessPoints, useServers } from "@/lib/hooks";
import { StatTile } from "@/components/ui/StatTile";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { StatusBadge, statusColor, type Status } from "@/components/ui/StatusBadge";
import { Clock } from "@/components/layout/Clock";
import { Countdowns } from "@/components/layout/Countdowns";

const LOW_SUPPLY_THRESHOLD = 10;

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

// Offline/error printers first, then online ones ordered by their lowest
// remaining ink/toner level (most urgent first).
function sortPrintersByUrgency<T extends { status: Status; supplies: SupplyLike[] }>(
  printers: T[] | undefined,
): T[] {
  if (!printers) return [];
  return [...printers].sort((a, b) => {
    const aOffline = a.status !== "online" ? 0 : 1;
    const bOffline = b.status !== "online" ? 0 : 1;
    if (aOffline !== bOffline) return aOffline - bOffline;
    return minTonerPercent(a) - minTonerPercent(b);
  });
}

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
  // Browsers won't auto-fullscreen a page, but they will on the first user
  // gesture — this makes the very first click/tap anywhere go fullscreen
  // (hiding the address bar) without needing a visible button.
  useEffect(() => {
    const goFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
      document.removeEventListener("click", goFullscreen);
    };
    document.addEventListener("click", goFullscreen);
    return () => document.removeEventListener("click", goFullscreen);
  }, []);

  const { data: printers } = usePrinters();
  const { data: cameras } = useCameras();
  const { data: accessPoints } = useAccessPoints();
  const { data: servers } = useServers();

  const printersOnline = printers?.filter((p) => p.status === "online").length ?? 0;
  const camerasOnline = cameras?.filter((c) => c.status === "online").length ?? 0;
  const apsOnline = accessPoints?.filter((a) => a.status === "online").length ?? 0;
  const serversOnline = servers?.filter((s) => s.status === "online").length ?? 0;

  const sortedAccessPoints = sortProblemsFirst(accessPoints);
  const sortedPrinters = sortPrintersByUrgency(printers);
  const sortedCameras = sortProblemsFirst(cameras);
  const sortedServers = sortProblemsFirst(servers);

  const printersWithLowSupply =
    printers?.filter((p) =>
      p.supplies.some(
        (s) => isTonerLike(s) && s.levelPercent !== null && s.levelPercent <= LOW_SUPPLY_THRESHOLD,
      ),
    ) ?? [];

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

      <div className="grid grid-cols-5 gap-3">
        <StatTile
          label="Access points online"
          value={`${apsOnline}/${accessPoints?.length ?? 0}`}
          icon={<Wifi className="h-4 w-4" />}
          tone="cyan"
        />
        <StatTile
          label="Printers online"
          value={`${printersOnline}/${printers?.length ?? 0}`}
          icon={<Printer className="h-4 w-4" />}
          tone="accent"
        />
        <StatTile
          label="Supply alerts"
          value={printersWithLowSupply.length}
          hint={printersWithLowSupply.length ? `printers below ${LOW_SUPPLY_THRESHOLD}%` : "all ok"}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={printersWithLowSupply.length ? "amber" : "accent"}
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
          <div
            className="no-scrollbar grid h-full content-start gap-1.5 overflow-y-auto p-2"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(13rem, 1fr))" }}
          >
            {!printers?.length && (
              <p className="text-xs text-[var(--text-dim)]">No printers configured.</p>
            )}
            {sortedPrinters.map((p) => {
              const tonerSupplies = p.supplies.filter(isTonerLike);
              const baseLabelCounts = tonerSupplies.reduce<Record<string, number>>((acc, s) => {
                const base = supplyShortLabel(s);
                acc[base] = (acc[base] ?? 0) + 1;
                return acc;
              }, {});
              const baseLabelSeen: Record<string, number> = {};
              return (
              <div key={p.id} className="glass-chip rounded-[0.25rem] px-2 py-1.5" style={printerChipStyle(p)}>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="truncate text-[0.6875rem] font-bold text-[var(--text-primary)]">{p.ipAddress} ({p.name})</span>
                  <StatusBadge status={p.status} hideLabel className="shrink-0" />
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
            })}
          </div>
        </TerminalPanel>

        <div className="grid min-h-0 gap-3" style={{ gridTemplateRows: "1fr 3fr" }}>
          <TerminalPanel
            title={`servers (${servers?.length ?? 0})`}
            bodyClassName="overflow-hidden p-0"
          >
            <div
              className="no-scrollbar grid h-full content-start gap-0.5 overflow-y-auto p-1"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))" }}
            >
              {!servers?.length && (
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
              {!cameras?.length && (
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
