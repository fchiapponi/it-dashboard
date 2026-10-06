import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { label, TONES } from "@/lib/format";

const TONE_CLASSES = {
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  amber: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  gray: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  red: "bg-red-500/10 text-red-700 dark:text-red-300",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

/** Pill for a status/priority key; its label and color come from lib/format. */
export function Badge({ value, tone, children }: { value?: string; tone?: keyof typeof TONE_CLASSES; children?: ReactNode }) {
  const t = tone ?? (value ? TONES[value] : undefined) ?? "gray";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONE_CLASSES[t])}>
      {children ?? (value ? label(value) : null)}
    </span>
  );
}

export function DeptBadge({ dept }: { dept: { name: string; color: string } }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap">
      <span className="size-2 rounded-full" style={{ background: dept.color }} />
      {dept.name}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-dim">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-dim">{children}</div>;
}

export function Field({ label: text, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{text}</span>
      {children}
    </label>
  );
}

export function Section({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("card overflow-hidden", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Horizontally-scrolling wrapper so wide tables never push the page sideways. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function FilterTabs({ items, active }: { items: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm",
            i.key === active ? "bg-panel font-medium shadow-sm ring-1 ring-line" : "text-dim hover:text-fg",
          )}
        >
          {i.label}
          {i.count !== undefined && <span className="ml-1.5 text-xs text-dim">{i.count}</span>}
        </Link>
      ))}
    </div>
  );
}

export function Stat({ label: text, value, href, tone }: { label: string; value: number | string; href?: string; tone?: "red" | "amber" }) {
  const body = (
    <div className="card p-4 transition hover:border-accent/40">
      <div className="text-xs font-medium text-dim">{text}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "red" && "text-red-600 dark:text-red-400",
          tone === "amber" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
