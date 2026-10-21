import type { Message } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export type Status = "online" | "offline" | "error" | "warning" | "dormant" | "alerting" | "unknown";

const STATUS_CONFIG: Record<Status, { label: Message; color: string; glow: string }> = {
  online: { label: "Online", color: "var(--accent)", glow: "var(--accent-glow)" },
  offline: { label: "Offline", color: "var(--red)", glow: "var(--red-glow)" },
  error: { label: "Error", color: "var(--red)", glow: "var(--red-glow)" },
  warning: { label: "Warning", color: "var(--amber)", glow: "var(--amber-glow)" },
  alerting: { label: "Alerting", color: "var(--amber)", glow: "var(--amber-glow)" },
  dormant: { label: "Dormant", color: "var(--red)", glow: "var(--red-glow)" },
  unknown: { label: "Unknown", color: "var(--text-faint)", glow: "transparent" },
};

export function statusColor(status: Status): string {
  return (STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown).color;
}

export function StatusBadge({
  status,
  className,
  hideLabel = false,
  colorOverride,
}: {
  status: Status;
  className?: string;
  hideLabel?: boolean;
  colorOverride?: string;
}) {
  const { t } = useI18n();
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  const color = colorOverride ?? cfg.color;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-[0.625rem] tracking-[0.12em] uppercase", className)}
      style={{ color }}
      title={hideLabel ? t(cfg.label) : undefined}
    >
      <span
        className="status-dot inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color, color: cfg.glow }}
      />
      {!hideLabel && t(cfg.label)}
    </span>
  );
}
