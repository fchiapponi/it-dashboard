"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, CalendarDays, LayoutDashboard, LogOut, Package, Settings, Ticket, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: LayoutDashboard,
  tickets: Ticket,
  events: CalendarDays,
  visitors: UserCheck,
  deliveries: Package,
  inventory: Boxes,
  admin: Settings,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

export function Nav({ items, user, signOut }: { items: NavItem[]; user: { name: string; email: string }; signOut: () => Promise<void> }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="no-print border-b border-line bg-panel md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-r md:border-b-0">
      <div className="flex items-center justify-between px-4 py-3 md:py-5">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-xs font-bold text-accent-fg">T</span>
          TASIS Helpdesk
        </Link>
        <form action={signOut} className="md:hidden">
          <button className="btn px-2" title="Sign out">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-0">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                isActive(item.href) ? "bg-panel-muted font-medium text-fg" : "text-dim hover:bg-panel-muted hover:text-fg",
              )}
            >
              <Icon className="size-4" />
              {item.label}
              {!!item.badge && (
                <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-fg">{item.badge}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="hidden border-t border-line p-3 md:block">
        <div className="truncate px-1 text-sm font-medium">{user.name}</div>
        <div className="truncate px-1 text-xs text-dim">{user.email}</div>
        <form action={signOut} className="mt-2">
          <button className="btn w-full justify-start border-0 px-1 text-dim">
            <LogOut className="size-4" /> Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
