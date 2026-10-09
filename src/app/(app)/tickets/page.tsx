import Link from "next/link";
import { Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma";
import { Badge, Empty, FilterTabs, PageHeader, Section, TableWrap, toneClasses } from "@/components/ui";
import { isAgentOf, requireUser } from "@/lib/auth";
import { fmtDate, fmtDateTime, fmtRelative, label, startOfToday, TICKET_STATUSES } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ACTIVE_STATUSES, visibleTickets } from "@/lib/tickets";
import { cn } from "@/lib/utils";
import { TicketDetail } from "./[number]/TicketDetail";

const VIEWS = ["queue", "assigned", "mine"] as const;

export default async function TicketsPage({ searchParams }: PageProps<"/tickets">) {
  const user = await requireUser();
  const sp = await searchParams;
  // "active" (default), "any", or a single status.
  const STATES = ["active", ...TICKET_STATUSES, "any"] as const;
  const state = STATES.find((s) => s === sp.state) ?? "active";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  // The ticket open in the reading pane next to the list, like a mail client.
  const open = typeof sp.t === "string" ? sp.t : null;

  // Tickets are always shown one department at a time, never mixed.
  const departments = await prisma.department.findMany({ where: { takesTickets: true }, orderBy: { name: "asc" } });
  const dept =
    departments.find((d) => d.slug === sp.dept) ?? departments.find((d) => user.departmentIds.includes(d.id)) ?? departments[0];
  if (!dept) return <PageHeader title="Tickets" subtitle="No department takes tickets yet. Add one in Admin." />;

  const agent = isAgentOf(user, dept.id);
  const view = agent ? (VIEWS.find((v) => v === sp.view) ?? "queue") : "mine";

  const where: Prisma.TicketWhereInput[] = [visibleTickets(user)];
  if (view === "assigned") where.push({ assignees: { some: { userId: user.id } } });
  if (view === "mine") where.push({ requesterId: user.id });
  if (q) {
    const n = Number.parseInt(q.replace(/^#/, ""), 10);
    where.push({ OR: [{ title: { contains: q } }, { description: { contains: q } }, ...(Number.isFinite(n) ? [{ number: n }] : [])] });
  }

  const stateWhere: Prisma.TicketWhereInput =
    state === "active" ? { status: { in: ACTIVE_STATUSES } } : state === "any" ? {} : { status: state };

  const [tickets, counts, statusCounts] = await Promise.all([
    prisma.ticket.findMany({
      where: { AND: [...where, stateWhere, { departmentId: dept.id }] },
      include: {
        requester: true,
        assignees: { include: { user: true }, orderBy: { createdAt: "asc" } },
        location: true,
        // Last public reply; internal notes aren't replies to the requester.
        activity: { where: { kind: "comment" }, orderBy: { createdAt: "desc" }, take: 1, include: { author: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    }),
    // Active tickets per department for the tab badges.
    prisma.ticket.groupBy({
      by: ["departmentId"],
      where: { AND: [visibleTickets(user), { status: { in: ACTIVE_STATUSES } }] },
      _count: true,
    }),
    // Tickets per status in this department and view, for the status pills.
    prisma.ticket.groupBy({ by: ["status"], where: { AND: [...where, { departmentId: dept.id }] }, _count: true }),
  ]);
  const countOf = (s: (typeof STATES)[number]) =>
    statusCounts
      .filter((c) => (s === "any" ? true : s === "active" ? ACTIVE_STATUSES.includes(c.status) : c.status === s))
      .reduce((n, c) => n + c._count, 0);

  const today = startOfToday();

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { dept: dept.slug, view, state, q: q || null, t: open, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/tickets?${p}`;
  };

  const viewTabs = agent
    ? [
        { key: "queue", label: "Department queue", href: href({ view: "queue" }) },
        { key: "assigned", label: "Assigned to me", href: href({ view: "assigned" }) },
        { key: "mine", label: "My requests", href: href({ view: "mine" }) },
      ]
    : [{ key: "mine", label: "My requests", href: href({ view: "mine" }) }];

  return (
    <>
      <PageHeader
        title="Tickets"
        subtitle="Requests to IT, Facilities and Kitchen & Dining"
        actions={
          <Link href={`/tickets/new?dept=${dept.slug}`} className="btn btn-primary">
            <Plus className="size-4" /> New ticket
          </Link>
        }
      />

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {departments.map((d) => {
          const count = counts.find((c) => c.departmentId === d.id)?._count ?? 0;
          // Switching department starts from that department's default view.
          const tab = new URLSearchParams({ dept: d.slug, ...(state !== "active" ? { state } : {}) });
          return (
            <Link
              key={d.id}
              href={`/tickets?${tab}`}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium",
                d.id === dept.id ? "text-fg" : "border-transparent text-dim hover:text-fg",
              )}
              style={d.id === dept.id ? { borderColor: d.color } : undefined}
            >
              <span className="size-2.5 rounded-full" style={{ background: d.color }} />
              {d.name}
              {count > 0 && <span className="rounded-full bg-panel-muted px-1.5 text-xs text-dim tabular-nums">{count}</span>}
            </Link>
          );
        })}
      </div>

      <FilterTabs items={viewTabs} active={view} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATES.map((s) => (
            <Link
              key={s}
              href={href({ state: s })}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ring-current transition",
                s === "active" || s === "any" ? "bg-panel-muted text-fg" : toneClasses(s),
                s === state ? "ring-2" : "opacity-60 hover:opacity-100",
              )}
            >
              {s === "active" ? "Active" : s === "any" ? "All" : label(s)}
              <span className="ml-1.5 tabular-nums opacity-70">{countOf(s)}</span>
            </Link>
          ))}
        </div>
        <form className="ml-auto flex gap-2" action="/tickets">
          <input type="hidden" name="dept" value={dept.slug} />
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="state" value={state} />
          {open && <input type="hidden" name="t" value={open} />}
          <input name="q" defaultValue={q} placeholder="Search title or #number" className="input w-56" />
          <button className="btn">Search</button>
        </form>
      </div>

      {open ? (
        <div data-wide className="grid gap-4 lg:grid-cols-[minmax(300px,400px)_1fr]">
          <Section className="hidden self-start lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            {tickets.length === 0 ? (
              <Empty>No {dept.name} tickets here.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {tickets.map((t) => (
                  <TicketRow key={t.id} ticket={t} href={href({ t: String(t.number) })} selected={String(t.number) === open} today={today} />
                ))}
              </ul>
            )}
          </Section>
          <div className="min-w-0 self-start lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <TicketDetail key={open} number={Number.parseInt(open, 10)} pane={{ closeHref: href({ t: null }) }} />
          </div>
        </div>
      ) : (
        <Section>
          {tickets.length === 0 ? (
            <Empty>No {dept.name} tickets here.</Empty>
          ) : (
            <TableWrap>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Requester</th>
                    <th>Assignee</th>
                    <th>Due</th>
                    <th>Opened</th>
                    <th>Last reply</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-panel-muted">
                      <td className="text-dim tabular-nums">{t.number}</td>
                      <td className="max-w-80">
                        <Link href={href({ t: String(t.number) })} scroll={false} className="font-medium hover:underline">
                          {t.title}
                        </Link>
                        {t.location && <div className="text-xs text-dim">{t.location.name}</div>}
                      </td>
                      <td>
                        <Badge value={t.status} />
                      </td>
                      <td>
                        <Badge value={t.priority} />
                      </td>
                      <td className="whitespace-nowrap">{t.requester.name}</td>
                      <td className="text-dim">{t.assignees.map((a) => a.user.name).join(", ") || "—"}</td>
                      <td
                        className={cn(
                          "whitespace-nowrap",
                          t.dueAt && ACTIVE_STATUSES.includes(t.status) && t.dueAt < today ? "font-medium text-red-600 dark:text-red-400" : "text-dim",
                        )}
                      >
                        {t.dueAt ? fmtDate(t.dueAt) : "—"}
                      </td>
                      <td className="whitespace-nowrap text-dim">{fmtDateTime(t.createdAt)}</td>
                      <td className="whitespace-nowrap">
                        <LastReply ticket={t} />
                      </td>
                      <td className="whitespace-nowrap text-dim">{fmtRelative(t.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Section>
      )}
    </>
  );
}

function LastReply({
  ticket,
}: {
  ticket: { status: string; requesterId: string; activity: { authorId: string | null; createdAt: Date; author: { name: string } | null }[] };
}) {
  const reply = ticket.activity[0];
  if (!reply) return <span className="text-dim">No replies yet</span>;
  const fromRequester = reply.authorId === ticket.requesterId;
  return (
    <>
      <div className="flex items-center gap-2">
        {reply.author?.name ?? "Deleted user"}
        {ACTIVE_STATUSES.includes(ticket.status) && ticket.status !== "standby" && (
          <Badge tone={fromRequester ? "amber" : "green"}>{fromRequester ? "Awaiting staff" : "Staff replied"}</Badge>
        )}
      </div>
      <div className="text-xs text-dim">{fmtRelative(reply.createdAt)}</div>
    </>
  );
}

/** A compact list entry for the side list while a ticket is open in the reading pane. */
function TicketRow({
  ticket: t,
  href,
  selected,
  today,
}: {
  ticket: {
    number: number;
    title: string;
    status: string;
    priority: string;
    dueAt: Date | null;
    updatedAt: Date;
    requester: { name: string };
    location: { name: string } | null;
  };
  href: string;
  selected: boolean;
  today: Date;
}) {
  const overdue = t.dueAt && ACTIVE_STATUSES.includes(t.status) && t.dueAt < today;
  return (
    <li>
      <Link
        href={href}
        scroll={false}
        aria-current={selected ? "page" : undefined}
        className={cn("block border-l-2 px-4 py-3 text-sm", selected ? "border-accent bg-panel-muted" : "border-transparent hover:bg-panel-muted")}
      >
        <div className="flex items-center gap-2 text-xs text-dim">
          <span className="tabular-nums">#{t.number}</span>
          <span className="min-w-0 truncate">{t.requester.name}</span>
          <span className="ml-auto shrink-0">{fmtRelative(t.updatedAt)}</span>
        </div>
        <div className="mt-0.5 truncate font-medium">{t.title}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge value={t.status} />
          {t.priority !== "normal" && <Badge value={t.priority} />}
          {overdue && <span className="text-xs font-medium text-red-600 dark:text-red-400">Overdue</span>}
          {t.location && <span className="min-w-0 truncate text-xs text-dim">{t.location.name}</span>}
        </div>
      </Link>
    </li>
  );
}
