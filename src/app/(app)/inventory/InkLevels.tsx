import type { Supply } from "@/lib/printerSnmp";
import { cn } from "@/lib/utils";

const COLOURS: Record<string, string> = {
  black: "bg-zinc-800 dark:bg-zinc-300",
  cyan: "bg-cyan-500",
  magenta: "bg-fuchsia-500",
  yellow: "bg-yellow-400",
};

const LOW = 10; // percent at or below which a supply is flagged

const isLow = (s: Supply) => s.percent !== null && s.percent <= LOW;
const text = (s: Supply) => (s.percent !== null ? `${s.percent}%` : s.ok ? "OK" : "?");

/** Ink/toner levels: tags for list cells (compact), labelled bars for the asset page. */
export function InkLevels({ supplies, compact }: { supplies: Supply[]; compact?: boolean }) {
  if (!supplies.length) return <>—</>;

  // One tag per cartridge: colour dot, order code and level, red when nearly empty.
  if (compact) {
    return (
      <span className="flex flex-wrap gap-1">
        {supplies.map((s) => (
          <span
            key={s.name}
            title={s.name}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs whitespace-nowrap",
              isLow(s) ? "bg-red-500/10 font-medium text-red-700 dark:text-red-300" : "bg-zinc-500/10 text-fg",
            )}
          >
            <span className={cn("size-2 rounded-full", COLOURS[s.colour ?? ""] ?? "bg-zinc-400")} />
            {s.code ?? s.name}
            <span className={cn("tabular-nums", !isLow(s) && "text-dim")}>{text(s)}</span>
          </span>
        ))}
      </span>
    );
  }

  return (
    <ul className="space-y-2">
      {supplies.map((s) => (
        <li key={s.name} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3 text-sm">
          <span className="truncate">
            {s.name}
            {s.code && <span className="ml-1.5 text-xs text-dim">{s.code}</span>}
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-zinc-500/15">
            <span
              className={cn("block h-full rounded-full", COLOURS[s.colour ?? ""] ?? "bg-zinc-400")}
              style={{ width: `${s.percent ?? (s.ok ? 100 : 0)}%` }}
            />
          </span>
          <span className={cn("text-right tabular-nums", isLow(s) ? "font-medium text-red-600 dark:text-red-400" : "text-dim")}>{text(s)}</span>
        </li>
      ))}
    </ul>
  );
}
