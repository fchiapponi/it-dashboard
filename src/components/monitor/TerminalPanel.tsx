import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function TerminalPanel({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("glass-panel relative flex h-full flex-col rounded-[6px]", className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-faint)]">[</span>
          <span className="text-xs tracking-[0.15em] text-[var(--text-dim)] uppercase">{title}</span>
          <span className="text-[var(--text-faint)]">]</span>
        </div>
        {actions}
      </div>
      <div className={cn("min-h-0 flex-1 p-3", bodyClassName)}>{children}</div>
    </div>
  );
}
