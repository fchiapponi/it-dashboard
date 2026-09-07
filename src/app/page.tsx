"use client";

import type { CSSProperties } from "react";
import { Printer, Video, Wifi, AlertTriangle, TerminalSquare } from "lucide-react";
import { usePrinters, useCameras, useAccessPoints } from "@/lib/hooks";
import { StatTile } from "@/components/ui/StatTile";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { StatusBadge, statusColor, type Status } from "@/components/ui/StatusBadge";
import { levelColor } from "@/components/ui/LevelBar";
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

function chipStyle(status: Status): CSSProperties {
  if (status === "online" || status === "unknown") return {};
  const color = statusColor(status);
  return { borderColor: color, boxShadow: `inset 0 0 0 1px ${color}, 0 0 10px -2px ${color}` };
}

function isTonerLike(supply: { type: string }): boolean {
  return supply.type === "ink" || supply.type === "toner";
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

  const printersOnline = printers?.filter((p) => p.status === "online").length ?? 0;
  const camerasOnline = cameras?.filter((c) => c.status === "online").length ?? 0;
  const apsOnline = accessPoints?.filter((a) => a.status === "online").length ?? 0;

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

      <div className="grid grid-cols-4 gap-3">
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
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-3">
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
            {accessPoints?.map((a) => (
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
            className="no-scrollbar grid h-full content-start gap-0.5 overflow-y-auto p-1"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))" }}
          >
            {!printers?.length && (
              <p className="text-xs text-[var(--text-dim)]">No printers configured.</p>
            )}
            {printers?.map((p) => {
              const tonerSupplies = p.supplies.filter(isTonerLike);
              const baseLabelCounts = tonerSupplies.reduce<Record<string, number>>((acc, s) => {
                const base = supplyShortLabel(s);
                acc[base] = (acc[base] ?? 0) + 1;
                return acc;
              }, {});
              const baseLabelSeen: Record<string, number> = {};
              return (
              <div key={p.id} className="glass-chip rounded-[0.25rem] px-1 py-0.5" style={chipStyle(p.status)}>
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[0.5rem] text-[var(--text-primary)]">{p.name}</span>
                  <StatusBadge status={p.status} hideLabel className="shrink-0" />
                </div>
                {tonerSupplies.length > 0 && (
                  <div className="no-scrollbar mt-1 flex flex-nowrap gap-x-2 overflow-x-auto">
                    {tonerSupplies.map((s) => {
                      const color = levelColor(s.levelPercent);
                      const base = supplyShortLabel(s);
                      baseLabelSeen[base] = (baseLabelSeen[base] ?? 0) + 1;
                      const label = baseLabelCounts[base] > 1 ? `${base}${baseLabelSeen[base]}` : base;
                      return (
                        <span
                          key={s.id}
                          title={s.name}
                          className="flex shrink-0 items-center gap-1 text-[0.5rem] tabular-nums"
                          style={{ color }}
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
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
            {cameras?.map((c) => (
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
  );
}
