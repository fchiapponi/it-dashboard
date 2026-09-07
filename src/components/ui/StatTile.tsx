import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "accent",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "accent" | "cyan" | "amber" | "red";
}) {
  const color = {
    accent: "var(--accent)",
    cyan: "var(--cyan)",
    amber: "var(--amber)",
    red: "var(--red)",
  }[tone];

  return (
    <div className="glass-panel relative overflow-hidden rounded-[0.375rem] p-4">
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl"
        style={{ background: color }}
      />
      <div className="flex items-center justify-between text-[var(--text-faint)]">
        <span className="text-[0.625rem] uppercase tracking-[0.15em]">{label}</span>
        {icon && (
          <span className={cn("opacity-80")} style={{ color }}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums" style={{ color, textShadow: `0 0 12px ${color}55` }}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[0.625rem] text-[var(--text-dim)]">{hint}</div>}
    </div>
  );
}
