import { cn } from "@/lib/utils";

export function levelColor(percent: number | null): string {
  if (percent === null) return "var(--text-faint)";
  if (percent <= 15) return "var(--red)";
  if (percent <= 35) return "var(--amber)";
  return "var(--accent)";
}

export function LevelBar({
  label,
  percent,
  className,
}: {
  label: string;
  percent: number | null;
  className?: string;
}) {
  const color = levelColor(percent);
  const pct = percent ?? 0;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="w-28 shrink-0 truncate text-[0.6875rem] text-[var(--text-dim)]" title={label}>
        {label}
      </span>
      <div className="h-3 flex-1 overflow-hidden rounded-[0.125rem] border border-[var(--border)] bg-black/40">
        <div
          className="h-full transition-all duration-700"
          style={{
            width: `${Math.max(2, pct)}%`,
            background: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      </div>
      <span
        className="w-10 shrink-0 text-right text-[0.6875rem] tabular-nums"
        style={{ color }}
      >
        {percent === null ? "N/A" : `${percent}%`}
      </span>
    </div>
  );
}
