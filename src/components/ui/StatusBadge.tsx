import { cn } from "@/lib/utils";

export type Status = "online" | "offline" | "error" | "warning" | "dormant" | "alerting" | "unknown";

const STATUS_CONFIG: Record<Status, { label: string; color: string; glow: string }> = {
  online: { label: "ONLINE", color: "var(--accent)", glow: "var(--accent-glow)" },
  offline: { label: "OFFLINE", color: "var(--red)", glow: "var(--red-glow)" },
  error: { label: "ERROR", color: "var(--red)", glow: "var(--red-glow)" },
  warning: { label: "WARNING", color: "var(--amber)", glow: "var(--amber-glow)" },
  alerting: { label: "ALERTING", color: "var(--amber)", glow: "var(--amber-glow)" },
  dormant: { label: "DORMANT", color: "var(--red)", glow: "var(--red-glow)" },
  unknown: { label: "UNKNOWN", color: "var(--text-faint)", glow: "transparent" },
};

export function statusColor(status: Status): string {
  return (STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown).color;
}

export function StatusBadge({
  status,
  className,
  hideLabel = false,
}: {
  status: Status;
  className?: string;
  hideLabel?: boolean;
}) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-[0.625rem] tracking-[0.12em] uppercase", className)}
      style={{ color: cfg.color }}
      title={hideLabel ? cfg.label : undefined}
    >
      <span
        className="status-dot inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: cfg.color, color: cfg.glow }}
      />
      {!hideLabel && cfg.label}
    </span>
  );
}
