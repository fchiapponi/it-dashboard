import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowLeftRight, CalendarDays, ChevronRight, Clock, Inbox, MapPin, Package, Plus, Ticket, UserCheck, UserRound, Users } from "lucide-react";
import { Badge, DeptBadge, Empty, PageHeader } from "@/components/ui";
import { isAgentOf, isReception, requireUser } from "@/lib/auth";
import { getDepartment } from "@/lib/department";
import { fmtDate, fmtRelative, fmtTime, startOfToday } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { INTL } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { ACTIVE_STATUSES, lowStockCount } from "@/lib/tickets";
import { chooseDepartment, leaveDepartment } from "./actions";

const DAY = 864e5;

/** Bar colors for the active statuses, matching the Badge tones in lib/format. */
const STATUS_BAR = [
  { key: "open", label: "Open", bar: "bg-blue-500" },
  { key: "in_progress", label: "In progress", bar: "bg-violet-500" },
  { key: "waiting", label: "Waiting", bar: "bg-amber-500" },
  { key: "standby", label: "Standby", bar: "bg-cyan-500" },
] as const;

/**
 * The home page: first pick a department, then its overview (tiles, the department's card), then the
 * tickets, events and desk items behind the numbers. Only the picked department's data is shown.
 */
export default async function Dashboard() {
  const user = await requireUser();
  const department = await getDepartment();
  if (!department) return <DepartmentPicker />;
  const { t, locale } = await getI18n();
  const agent = isAgentOf(user, department.id);
  const reception = department.slug === "reception" && isReception(user);
  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + DAY);
  const active = { status: { in: ACTIVE_STATUSES }, departmentId: department.id };

  // The department's queue card, for the people who work it.
  const departments = agent && department.takesTickets ? [department] : [];
  const inDepts = { departmentId: department.id };
  const ticketRow = { department: true, assignees: { select: { userId: true } } } as const;

  const [assignedToMe, myOpen, myDeliveries, lowStock, byStatus, unassigned, urgent, overdue, attention, mine, events, myParcels] =
    await Promise.all([
      prisma.ticket.count({ where: { ...active, assignees: { some: { userId: user.id } } } }),
      prisma.ticket.count({ where: { ...active, requesterId: user.id } }),
      prisma.delivery.count({ where: { recipientId: user.id, status: "received" } }),
      agent ? lowStockCount([department.id]) : 0,
      prisma.ticket.groupBy({ by: ["departmentId", "status"], where: { ...inDepts, ...active }, _count: true }),
      prisma.ticket.groupBy({ by: ["departmentId"], where: { ...inDepts, ...active, assignees: { none: {} } }, _count: true }),
      prisma.ticket.groupBy({ by: ["departmentId"], where: { ...inDepts, ...active, priority: "urgent" }, _count: true }),
      prisma.ticket.groupBy({ by: ["departmentId"], where: { ...inDepts, ...active, dueAt: { lt: today } }, _count: true }),
      agent
        ? prisma.ticket.findMany({
            where: { ...inDepts, ...active, OR: [{ priority: "urgent" }, { dueAt: { lt: today } }, { assignees: { none: {} } }] },
            include: ticketRow,
            orderBy: { createdAt: "asc" },
            take: 40,
          })
        : [],
      // Agents see the tickets they work on; everyone else the requests they made.
      prisma.ticket.findMany({
        where: { ...active, ...(agent ? { assignees: { some: { userId: user.id } } } : { requesterId: user.id }) },
        include: ticketRow,
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      prisma.event.findMany({
        where: { endsAt: { gte: new Date() }, startsAt: { lt: new Date(today.getTime() + 7 * DAY) }, status: { not: "cancelled" } },
        include: { location: true },
        orderBy: { startsAt: "asc" },
        take: 5,
      }),
      prisma.delivery.findMany({ where: { recipientId: user.id, status: "received" }, orderBy: { receivedAt: "desc" }, take: 4 }),
    ]);

  const desk = reception
    ? await Promise.all([
        prisma.visitor.findMany({ where: { checkedInAt: { not: null }, checkedOutAt: null }, include: { host: true }, orderBy: { checkedInAt: "desc" } }),
        prisma.visitor.findMany({
          where: { checkedInAt: null, expectedAt: { gte: today, lt: tomorrow } },
          include: { host: true },
          orderBy: { expectedAt: "asc" },
        }),
        prisma.delivery.count({ where: { status: "received" } }),
      ])
    : null;

  const countFor = (rows: { departmentId: string; _count: number }[], deptId: string) =>
    rows.find((r) => r.departmentId === deptId)?._count ?? 0;
  const statusCount = (deptId: string, status: string) =>
    byStatus.find((r) => r.departmentId === deptId && r.status === status)?._count ?? 0;

  // Why each ticket needs attention; urgent first, then overdue, then unassigned, oldest first within each.
  const flags = (tk: (typeof attention)[number]) => ({
    urgent: tk.priority === "urgent",
    overdue: !!tk.dueAt && tk.dueAt < today,
    unassigned: !tk.assignees.length,
  });
  const rank = (tk: (typeof attention)[number]) => {
    const f = flags(tk);
    return f.urgent ? 0 : f.overdue ? 1 : 2;
  };
  const needsAttention = [...attention].sort((a, b) => rank(a) - rank(b)).slice(0, 8);

  const firstName = user.name.split(" ")[0];
  const longDate = new Intl.DateTimeFormat(INTL[locale], { timeZone: "Europe/Zurich", weekday: "long", day: "numeric", month: "long" });
  const dayLabel = (d: Date) =>
    d < tomorrow ? t("Today") : d < new Date(tomorrow.getTime() + DAY) ? t("Tomorrow") : longDate.format(d);

  return (
    <>
      <PageHeader
        title={t("Hello, {name}", { name: firstName })}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="first-letter:uppercase">{longDate.format(new Date())}</span>·<DeptBadge dept={department} />
          </span>
        }
        actions={
          <>
            <form action={leaveDepartment}>
              <button className="btn">
                <ArrowLeftRight className="size-4" /> {t("Change department")}
              </button>
            </form>
            <Link href="/tickets/new" className="btn btn-primary">
              <Plus className="size-4" /> {t("New ticket")}
            </Link>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {agent && <Tile icon={UserCheck} label={t("Assigned to me")} value={assignedToMe} href="/tickets?view=assigned" />}
        <Tile icon={Ticket} label={t("My open requests")} value={myOpen} href="/tickets?view=mine" />
        <Tile icon={Package} label={t("Deliveries for me")} value={myDeliveries} tone={myDeliveries ? "amber" : undefined} href="/deliveries" />
        {agent && (
          <Tile icon={AlertTriangle} label={t("Supplies low")} value={lowStock} tone={lowStock ? "amber" : undefined} href="/inventory/supplies" />
        )}
      </div>

      {departments.length > 0 && (
        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {departments.map((d) => {
            const q = (state: string) => `/tickets?state=${state}`;
            const counts = STATUS_BAR.map((s) => ({ ...s, n: statusCount(d.id, s.key) }));
            const total = counts.reduce((a, s) => a + s.n, 0);
            const alerts = [
              { label: t("Unassigned"), n: countFor(unassigned, d.id), tone: "amber" as const },
              { label: t("Urgent"), n: countFor(urgent, d.id), tone: "red" as const },
              { label: t("Overdue"), n: countFor(overdue, d.id), tone: "red" as const },
            ];
            return (
              <section key={d.id} className="card overflow-hidden">
                <div className="h-1" style={{ background: d.color }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-sm font-semibold">
                      <DeptBadge dept={d} />
                    </h2>
                    <Link href={q("active")} className="text-right">
                      <div className="text-3xl leading-none font-semibold tabular-nums">{total}</div>
                      <div className="mt-1 text-xs text-dim">{t("active tickets")}</div>
                    </Link>
                  </div>

                  <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-panel-muted">
                    {counts
                      .filter((s) => s.n)
                      .map((s) => (
                        <div key={s.key} className={s.bar} style={{ width: `${(s.n / total) * 100}%` }} title={`${t(s.label)}: ${s.n}`} />
                      ))}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {counts.map((s) => (
                      <Link key={s.key} href={q(s.key)} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-panel-muted">
                        <span className={cn("size-2 rounded-full", s.bar)} />
                        <span className="text-dim">{t(s.label)}</span>
                        <span className="ml-auto font-medium tabular-nums">{s.n}</span>
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
                  {alerts.map((a) => (
                    <Link
                      key={a.label}
                      href={q("active")}
                      className={cn(
                        "px-3 py-2.5 text-center transition hover:bg-panel-muted",
                        a.n && a.tone === "red" && "bg-red-500/5",
                        a.n && a.tone === "amber" && "bg-amber-500/5",
                      )}
                    >
                      <div
                        className={cn(
                          "text-lg font-semibold tabular-nums",
                          !a.n && "text-dim",
                          a.n && a.tone === "red" && "text-red-600 dark:text-red-400",
                          a.n && a.tone === "amber" && "text-amber-600 dark:text-amber-400",
                        )}
                      >
                        {a.n}
                      </div>
                      <div className="text-xs text-dim">{a.label}</div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="grid gap-6 lg:col-span-2">
          {agent && (
            <Panel icon={AlertTriangle} title={t("Needs attention")} count={attention.length}>
              {needsAttention.length ? (
                <ul className="divide-y divide-line">
                  {needsAttention.map((tk) => {
                    const f = flags(tk);
                    return (
                      <TicketRow key={tk.id} ticket={tk} meta={fmtRelative(tk.createdAt, locale)}>
                        {f.urgent && <Badge value="urgent" />}
                        {f.overdue && <Badge tone="red">{t("Overdue")}</Badge>}
                        {f.unassigned && <Badge tone="amber">{t("Unassigned")}</Badge>}
                      </TicketRow>
                    );
                  })}
                </ul>
              ) : (
                <Empty>{t("Nothing urgent, overdue or unassigned.")}</Empty>
              )}
            </Panel>
          )}

          <Panel
            icon={agent ? UserCheck : Ticket}
            title={agent ? t("Assigned to me") : t("My open requests")}
            href={agent ? "/tickets?view=assigned" : "/tickets?view=mine"}
            more={t("View all")}
          >
            {mine.length ? (
              <ul className="divide-y divide-line">
                {mine.map((tk) => (
                  <TicketRow key={tk.id} ticket={tk} meta={t("updated {when}", { when: fmtRelative(tk.updatedAt, locale) })}>
                    <Badge value={tk.status} />
                    {tk.dueAt && (
                      <span className={cn("text-xs", tk.dueAt < today ? "text-red-600 dark:text-red-400" : "text-dim")}>
                        {t("due {date}", { date: fmtDate(tk.dueAt, locale) })}
                      </span>
                    )}
                  </TicketRow>
                ))}
              </ul>
            ) : (
              <Empty>{t("No open tickets.")}</Empty>
            )}
          </Panel>
        </div>

        <div className="grid gap-6">
          {desk && (
            <Panel icon={Users} title={t("Reception")} href="/visitors" more={t("View all")}>
              <div className="grid grid-cols-3 divide-x divide-line border-b border-line text-center">
                <MiniStat label={t("Visitors on site")} value={desk[0].length} href="/visitors" />
                <MiniStat label={t("Still expected today")} value={desk[1].length} href="/visitors" />
                <MiniStat label={t("Parcels on the shelf")} value={desk[2]} href="/deliveries" />
              </div>
              {desk[0].length + desk[1].length ? (
                <ul className="divide-y divide-line text-sm">
                  {[...desk[1], ...desk[0]].slice(0, 6).map((v) => (
                    <li key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                      <UserRound className="size-4 shrink-0 text-dim" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{v.name}</div>
                        <div className="truncate text-xs text-dim">{v.host?.name ?? v.hostName ?? v.company ?? ""}</div>
                      </div>
                      {v.checkedInAt ? (
                        <Badge tone="green">{t("On site")}</Badge>
                      ) : (
                        <span className="text-xs text-dim tabular-nums">{fmtTime(v.expectedAt, locale)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>{t("No visitors today.")}</Empty>
              )}
            </Panel>
          )}

          <Panel icon={CalendarDays} title={t("Next 7 days")} href="/events" more={t("View all")}>
            {events.length ? (
              <ul className="divide-y divide-line text-sm">
                {events.map((e) => (
                  <li key={e.id}>
                    <Link href={`/events/${e.id}`} className="flex gap-3 px-4 py-2.5 hover:bg-panel-muted">
                      <div className="w-16 shrink-0 text-xs text-dim">
                        <div className="truncate font-medium text-fg first-letter:uppercase">{dayLabel(e.startsAt)}</div>
                        <div className="tabular-nums">{fmtTime(e.startsAt, locale)}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{e.title}</div>
                        {e.location && (
                          <div className="flex items-center gap-1 truncate text-xs text-dim">
                            <MapPin className="size-3 shrink-0" /> {e.location.name}
                          </div>
                        )}
                      </div>
                      {e.status === "requested" && <Badge value="requested" />}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>{t("No events.")}</Empty>
            )}
          </Panel>

          {myParcels.length > 0 && (
            <Panel icon={Package} title={t("Deliveries for me")} href="/deliveries" more={t("View all")}>
              <ul className="divide-y divide-line text-sm">
                {myParcels.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Inbox className="size-4 shrink-0 text-dim" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{p.description || p.carrier || t("Parcel")}</div>
                      <div className="truncate text-xs text-dim">
                        {[p.storageSpot, fmtRelative(p.receivedAt, locale)].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    {p.packages > 1 && <span className="text-xs text-dim tabular-nums">×{p.packages}</span>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

/** The home page until a department is picked; the choice is kept in a cookie. */
async function DepartmentPicker() {
  const { t } = await getI18n();
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("Choose your department")} subtitle={t("You'll only see its tickets, inventory and board. You can change it any time.")} />
      {departments.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <form key={d.id} action={chooseDepartment.bind(null, d.slug)}>
              <button className="card flex h-full w-full overflow-hidden text-left transition hover:border-accent/40 hover:shadow-md">
                <span className="w-1.5 shrink-0" style={{ background: d.color }} />
                <span className="min-w-0 flex-1 p-5">
                  <span className="block text-lg font-semibold">{d.name}</span>
                  {d.description && <span className="mt-1 block text-sm text-dim">{d.description}</span>}
                </span>
                <ChevronRight className="m-5 size-5 shrink-0 self-center text-dim" />
              </button>
            </form>
          ))}
        </div>
      ) : (
        <Empty>{t("No departments yet. Add one in Admin.")}</Empty>
      )}
    </div>
  );
}

type Icon = typeof Ticket;

function Tile({ icon: I, label, value, href, tone }: { icon: Icon; label: string; value: number; href: string; tone?: "amber" }) {
  return (
    <Link href={href} className="card flex items-center gap-3 p-4 transition hover:border-accent/40">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-lg",
          tone === "amber" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-accent/10 text-accent",
        )}
      >
        <I className="size-5" />
      </span>
      <div className="min-w-0">
        <div className={cn("text-2xl leading-tight font-semibold tabular-nums", tone === "amber" && "text-amber-600 dark:text-amber-400")}>
          {value}
        </div>
        <div className="truncate text-xs font-medium text-dim">{label}</div>
      </div>
    </Link>
  );
}

function Panel({
  icon: I,
  title,
  count,
  href,
  more,
  children,
}: {
  icon: Icon;
  title: string;
  count?: number;
  href?: string;
  more?: string;
  children: ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <I className="size-4 text-dim" />
        <h2 className="text-sm font-semibold">{title}</h2>
        {!!count && <span className="rounded-full bg-panel-muted px-1.5 text-xs text-dim tabular-nums">{count}</span>}
        {href && more && (
          <Link href={href} className="ml-auto flex items-center text-xs text-dim hover:text-fg">
            {more} <ChevronRight className="size-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function MiniStat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="px-2 py-3 transition hover:bg-panel-muted">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] leading-tight text-dim">{label}</div>
    </Link>
  );
}

function TicketRow({
  ticket,
  meta,
  children,
}: {
  ticket: { number: number; title: string; department: { name: string; color: string } };
  meta: string;
  children: ReactNode;
}) {
  return (
    <li>
      <Link href={`/tickets/${ticket.number}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-panel-muted">
        <span className="w-12 shrink-0 text-xs text-dim tabular-nums">#{ticket.number}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{ticket.title}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-dim">
            <DeptBadge dept={ticket.department} />
            <Clock className="size-3" /> {meta}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">{children}</div>
      </Link>
    </li>
  );
}
