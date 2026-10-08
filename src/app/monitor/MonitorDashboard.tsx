"use client";

import type { CSSProperties } from "react";
import { Printer, Wifi, AlertTriangle, TerminalSquare, Users } from "lucide-react";
import { usePrinters, useAccessPoints, useTrello } from "@/lib/hooks";
import { StatTile } from "@/components/monitor/StatTile";
import { TerminalPanel } from "@/components/monitor/TerminalPanel";
import { StatusBadge, statusColor, type Status } from "@/components/monitor/StatusBadge";
import { Clock } from "@/components/monitor/Clock";
import { Countdowns } from "@/components/monitor/Countdowns";

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

type FaultLike = { status: Status; alert: string | null; alertLevel: "error" | "warning" | null };

// Fault reported by a reachable printer: "error" (jam, door open, …) or
// "warning" (paper problems — the printer waits, nothing is broken).
function printerFault(printer: FaultLike): "error" | "warning" | null {
  if (printer.status !== "online" || !printer.alert) return null;
  return printer.alertLevel ?? "error";
}

const FAULT_RANK = { error: 0, warning: 1, none: 2 } as const;

// Offline/error printers first, then online ones reporting a fault (errors
// before paper warnings), then ones low on ink/toner (lowest first), then the
// rest by lifetime page count (busiest first).
function sortPrintersByUrgency<
  T extends FaultLike & { name: string; pageCount: number | null; supplies: SupplyLike[] },
>(
  printers: T[] | undefined,
): T[] {
  if (!printers) return [];
  return [...printers].sort((a, b) => {
    const aOffline = a.status !== "online" ? 0 : 1;
    const bOffline = b.status !== "online" ? 0 : 1;
    if (aOffline !== bOffline) return aOffline - bOffline;
    const aFault = FAULT_RANK[printerFault(a) ?? "none"];
    const bFault = FAULT_RANK[printerFault(b) ?? "none"];
    if (aFault !== bFault) return aFault - bFault;
    const aLow = minTonerPercent(a) < LOW_SUPPLY_THRESHOLD;
    const bLow = minTonerPercent(b) < LOW_SUPPLY_THRESHOLD;
    if (aLow !== bLow) return aLow ? -1 : 1;
    if (aLow) return minTonerPercent(a) - minTonerPercent(b);
    return (b.pageCount ?? -1) - (a.pageCount ?? -1);
  });
}

// Printers that failed to respond to polling are shown as neutral gray
// (disconnected) rather than red — red is reserved for online printers that
// need attention (empty/low supplies).
const PRINTER_OFFLINE_COLOR = "var(--gray)";

// Same as chipStyle, but also flags online printers that report a fault or
// are dangerously low on ink/toner — not just ones that are outright
// unreachable. Error faults and empty (0%) are red; paper warnings and
// anything else under the threshold are amber.
function printerChipStyle(printer: FaultLike & { supplies: SupplyLike[] }): CSSProperties {
  if (printer.status === "online") {
    const minPercent = minTonerPercent(printer);
    const fault = printerFault(printer);
    if (fault === "error" || minPercent <= 0) {
      const color = statusColor("error");
      return { borderColor: color, boxShadow: `inset 0 0 0 1px ${color}, 0 0 10px -2px ${color}` };
    }
    if (fault === "warning" || minPercent < LOW_SUPPLY_THRESHOLD) {
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

// Cartridge part number from the supply name, e.g. "Cyan Ink Cartridge
// T08H2" → "T08H2", "Black Ink Supply Unit T13L1/T15R1/T13M1" →
// "T13L1/T15R1/T13M1" (Epson lists every compatible part).
function supplyCode(supply: { name: string }): string | null {
  const last = supply.name.replace(/\s*\(\d+\)$/, "").trim().split(/\s+/).pop() ?? "";
  return /\d/.test(last) && /[a-z]/i.test(last) ? last : null;
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
  const { data: accessPoints } = useAccessPoints();
  const { data: trelloLists } = useTrello();
  // Finished work isn't worth screen space on the TV.
  const openTrelloLists = trelloLists?.filter((list) => list.name.trim().toLowerCase() !== "done");

  const printersOnline = printers?.filter((p) => p.status === "online").length ?? 0;
  const apsOnline = accessPoints?.filter((a) => a.status === "online").length ?? 0;
  const totalClients = accessPoints?.reduce((sum, a) => sum + a.clientCount, 0) ?? 0;

  const sortedPrinters = sortPrintersByUrgency(printers);
  const offlinePrinters = sortedPrinters.filter((p) => p.status !== "online");
  const onlinePrinters = sortedPrinters.filter((p) => p.status === "online");

  function renderPrinterCard(p: (typeof sortedPrinters)[number]) {
    const faultLevel = printerFault(p);
    const fault = faultLevel ? p.alert : null;
    // Under a fault only the empty cartridges stay visible: vendor messages like
    // "You need to replace Ink Supply Unit." don't say which color.
    const allToner =
      p.status !== "online"
        ? []
        : p.supplies.filter(isTonerLike).filter((s) => !fault || s.levelPercent === 0);
    // When a card is flagged for low/empty ink, show only the colors that are
    // running out so the one to replace stands out.
    const lowInkOnly = minTonerPercent(p) < LOW_SUPPLY_THRESHOLD;
    const tonerSupplies = lowInkOnly
      ? allToner.filter((s) => s.levelPercent !== null && s.levelPercent < LOW_SUPPLY_THRESHOLD)
      : allToner;
    // An ink/toner fault is fully explained by the empty cartridge chip, so its
    // vendor text is dropped; other faults (jam, door open, …) keep theirs.
    const faultText = fault && tonerSupplies.length > 0 && /\b(ink|toner)\b/i.test(fault) ? null : fault;
    const baseLabelCounts = tonerSupplies.reduce<Record<string, number>>((acc, s) => {
      const base = supplyShortLabel(s);
      acc[base] = (acc[base] ?? 0) + 1;
      return acc;
    }, {});
    const baseLabelSeen: Record<string, number> = {};
    return (
      <div key={p.id} className="glass-chip rounded-[0.25rem] px-2 py-1.5" style={printerChipStyle(p)}>
        <div className="flex items-center justify-between gap-1.5">
          <span className="truncate text-[0.6875rem] font-bold text-[var(--text-primary)]">{p.name}</span>
          {p.pageCount !== null && (
            <span
              title="Pages printed"
              className="ml-auto shrink-0 text-[0.5625rem] tabular-nums text-[var(--text-dim)]"
            >
              {p.pageCount.toLocaleString("it-IT")}
            </span>
          )}
          <StatusBadge
            status={p.status}
            hideLabel
            className="shrink-0"
            colorOverride={
              p.status === "error" ? PRINTER_OFFLINE_COLOR : faultLevel ? statusColor(faultLevel) : undefined
            }
          />
        </div>
        {faultText && (
          <div
            title={faultText}
            className="mt-1.5 truncate text-[0.625rem] font-bold"
            style={{ color: statusColor(faultLevel ?? "error") }}
          >
            {faultText}
          </div>
        )}
        {tonerSupplies.length > 0 && (
          <div
            className={
              lowInkOnly
                ? "mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5"
                : "no-scrollbar mt-1.5 flex flex-nowrap gap-x-2.5 overflow-x-auto"
            }
          >
            {tonerSupplies.map((s) => {
              const base = supplyShortLabel(s);
              const color = swatchColor(base);
              baseLabelSeen[base] = (baseLabelSeen[base] ?? 0) + 1;
              const label = baseLabelCounts[base] > 1 ? `${base}${baseLabelSeen[base]}` : base;
              const code = lowInkOnly ? supplyCode(s) : null;
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
                  {code && <span className="text-[var(--text-dim)]">{code}</span>}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Printers whose card is amber: online, a paper warning or ink/toner under
  // the threshold, and nothing red (error fault or an empty supply).
  const printersWithAlert =
    printers?.filter((p) => {
      if (p.status !== "online") return false;
      const fault = printerFault(p);
      const minPercent = minTonerPercent(p);
      if (fault === "error" || minPercent <= 0) return false;
      return fault === "warning" || minPercent < LOW_SUPPLY_THRESHOLD;
    }) ?? [];
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

      <div className="grid grid-cols-5 gap-3">
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
          label="Printer alert"
          value={printersWithAlert.length}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={printersWithAlert.length ? "amber" : "accent"}
        />
        <StatTile
          label="Supply empty"
          value={printersWithEmptySupply.length}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={printersWithEmptySupply.length ? "red" : "accent"}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <TerminalPanel title="trello board" bodyClassName="overflow-hidden p-0">
          <div className="no-scrollbar h-full columns-2 gap-3 overflow-y-auto p-2 [column-fill:_balance]">
            {!openTrelloLists?.length && <p className="text-base text-[var(--text-dim)]">No Trello data.</p>}
            {openTrelloLists?.map((list) => (
              <div key={list.id} className="glass-panel mb-3 break-inside-avoid rounded-[6px]">
                <div className="truncate border-b border-white/10 px-2.5 py-1 text-xs tracking-[0.1em] text-[var(--text-dim)] uppercase">
                  {list.name} <span className="text-[var(--text-faint)]">({list.cards.length})</span>
                </div>
                <div className="flex flex-col gap-1 p-1.5">
                  {list.cards.map((card) => (
                    <div
                      key={card.id}
                      className="glass-chip rounded-[0.25rem] px-2 py-1 text-sm leading-snug text-[var(--text-primary)]"
                    >
                      {card.name}
                    </div>
                  ))}
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
      </div>
    </div>
  );
}
