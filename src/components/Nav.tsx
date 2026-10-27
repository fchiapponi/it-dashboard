"use client";

import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Boxes, CalendarDays, Clock, LayoutDashboard, LogOut, MonitorDot, Package, Settings, SquareKanban, Ticket, UserCheck, UtensilsCrossed } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { LanguageSwitch } from "@/i18n/LanguageSwitch";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: LayoutDashboard,
  tickets: Ticket,
  boards: SquareKanban,
  events: CalendarDays,
  visitors: UserCheck,
  deliveries: Package,
  inventory: Boxes,
  dining: UtensilsCrossed,
  hours: Clock,
  monitor: MonitorDot,
  admin: Settings,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };
export type NavSection = { name: string; color: string; items: NavItem[] };

// Text that only shows while the collapsed desktop sidebar is open on hover.
const REVEAL = "whitespace-nowrap transition-opacity md:opacity-0 md:group-hover:opacity-100";

// On desktop the sidebar is a rail of icons; hovering it widens it over the
// page to show the labels. On phones it stays a bar across the top.
export function Nav({
  items,
  sections,
  footer,
  user,
  signOut,
}: {
  items: NavItem[];
  sections: NavSection[];
  footer: NavItem[];
  user: { name: string; email: string };
  signOut?: () => Promise<void>;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The item whose path matches the page most closely, with the page's department (?dept=) if it names one:
  // /inventory/supplies?dept=it lights up IT's Inventory, /boards/it IT's Board rather than My board.
  const score = (href: string) => {
    const [path, query] = href.split("?");
    const dept = new URLSearchParams(query).get("dept");
    const onPath = pathname === path || (path !== "/" && pathname.startsWith(`${path}/`));
    return onPath && (!dept || dept === searchParams.get("dept")) ? path.length : -1;
  };
  const all = [...items, ...sections.flatMap((s) => s.items), ...footer];
  const best = Math.max(...all.map((i) => score(i.href)));
  const activeHref = best >= 0 ? all.find((i) => score(i.href) === best)?.href : undefined;

  const link = (item: NavItem) => {
    const Icon = ICONS[item.icon];
    return (
      <Link
        key={item.href}
        href={item.href}
        title={item.label}
        className={cn(
          "relative flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
          item.href === activeHref ? "bg-panel-muted font-medium text-fg" : "text-dim hover:bg-panel-muted hover:text-fg",
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className={REVEAL}>{item.label}</span>
        {!!item.badge && (
          <>
            <span className={cn("ml-auto rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-fg", REVEAL)}>
              {item.badge}
            </span>
            {/* A dot on the icon stands in for the count while the rail is collapsed. */}
            <span className="absolute top-1.5 left-6 hidden size-2 rounded-full bg-accent md:block md:group-hover:hidden" />
          </>
        )}
      </Link>
    );
  };

  return (
    // Holds the rail's width in the page flow; the sidebar itself is fixed so it
    // can widen over the content.
    <div className="no-print md:w-16 md:shrink-0">
      <aside className="group border-b border-line bg-panel md:fixed md:inset-y-0 md:left-0 md:z-50 md:flex md:w-16 md:flex-col md:overflow-hidden md:border-r md:border-b-0 md:transition-[width,box-shadow] md:duration-200 md:hover:w-60 md:hover:shadow-2xl">
        <div className="relative flex items-center justify-center px-4 py-3 md:px-2 md:py-5">
          <Link href="/" className="flex items-center">
            <Image
              src="/tasis-crest.png"
              alt="TASIS One"
              width={235}
              height={175}
              priority
              className="h-12 w-auto md:h-8 md:transition-[height] md:group-hover:h-16"
            />
          </Link>
          <div className="absolute right-4 flex items-center gap-2 md:hidden">
            <LanguageSwitch />
            {signOut && (
              <form action={signOut}>
                <button className="btn px-2" title={t("Sign out")}>
                  <LogOut className="size-4" />
                </button>
              </form>
            )}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-x-hidden md:overflow-y-auto">
          {items.map(link)}
          {sections.map((section) => (
            <Fragment key={section.name}>
              {/* The department's heading; collapsed, just its color. */}
              <div className="flex shrink-0 items-center gap-2.5 px-3 py-2 md:mt-3 md:py-1" title={section.name}>
                <span className="mx-0.5 size-2.5 shrink-0 rounded-full" style={{ background: section.color }} />
                <span className={cn("truncate text-xs font-semibold tracking-wide text-dim uppercase", REVEAL)}>{section.name}</span>
              </div>
              {section.items.map(link)}
            </Fragment>
          ))}
          {footer.length > 0 && <div className="shrink-0 md:mt-3" />}
          {footer.map(link)}
        </nav>
        <div className="hidden border-t border-line p-3 md:block">
          <div className={cn("truncate px-1 text-sm font-medium", REVEAL)}>{user.name}</div>
          <div className={cn("truncate px-1 text-xs text-dim", REVEAL)}>{user.email}</div>
          <LanguageSwitch className={cn("mt-2 ml-1", REVEAL)} />
          {signOut && (
            <form action={signOut} className="mt-2">
              <button className="btn w-full justify-start border-0 px-2 text-dim" title={t("Sign out")}>
                <LogOut className="size-4 shrink-0" /> <span className={REVEAL}>{t("Sign out")}</span>
              </button>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}
