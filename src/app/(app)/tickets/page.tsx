import Link from "next/link";
import { Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma";
import { Badge, DeptBadge, Empty, FilterTabs, PageHeader, Section, TableWrap, toneClasses } from "@/components/ui";
import { isAgentOf, requireUser } from "@/lib/auth";
import { requireDepartment } from "@/lib/department";
import { fmtDate, fmtDateTime, fmtRelative, label, startOfToday, TICKET_STATUSES } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ACTIVE_STATUSES, visibleTickets } from "@/lib/tickets";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import { TicketDetail } from "./[number]/TicketDetail";

const VIEWS = ["queue", "assigned", "mine"] as const;

export default async function TicketsPage({ searchParams }: PageProps<"/tickets">) {
  const user = await requireUser();
  const sp = await searchParams;
  const { t, locale } = await getI18n();
  // "active" (default), "any", or a single status.
  const STATES = ["active", ...TICKET_STATUSES, "any"] as const;
  const state = STATES.find((s) => s === sp.state) ?? "active";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  // The ticket open in the reading pane next to the list, like a mail client.
  const open = typeof sp.t === "string" ? sp.t : null;

  // One of the user's departments, picked in the sidebar; tickets of different departments are never mixed.
  const dept = await requireDepartment(sp.dept);
  if (!dept.takesTickets) return <PageHeader title={t("Tickets")} subtitle={t("{dept} doesn't take tickets.", { dept: dept.name })} />;

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

  const [tickets, statusCounts] = await Promise.all([
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
        { key: "queue", label: t("Department queue"), href: href({ view: "queue" }) },
        { key: "assigned", label: t("Assigned to me"), href: href({ view: "assigned" }) },
        { key: "mine", label: t("My requests"), href: href({ view: "mine" }) },
      ]
    : [{ key: "mine", label: t("My requests"), href: href({ view: "mine" }) }];

  return (
    <>
      <PageHeader
        title={t("Tickets")}
        subtitle={<DeptBadge dept={dept} />}
        actions={
          <Link href={`/tickets/new?dept=${dept.slug}`} className="btn btn-primary">
            <Plus className="size-4" /> {t("New ticket")}
          </Link>
        }
      />

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
              {s === "active" ? t("Active") : s === "any" ? t("All") : label(s, locale)}
              <span className="ml-1.5 tabular-nums opacity-70">{countOf(s)}</span>
            </Link>
          ))}
        </div>
        <form className="ml-auto flex gap-2" action="/tickets">
          <input type="hidden" name="dept" value={dept.slug} />
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="state" value={state} />
          {open && <input type="hidden" name="t" value={open} />}
          <input name="q" defaultValue={q} placeholder={t("Search title or #number")} className="input w-56" />
          <button className="btn">{t("Search")}</button>
        </form>
      </div>

      {open ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(300px,400px)_1fr]">
          <Section className="hidden self-start lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            {tickets.length === 0 ? (
              <Empty>{t("No {dept} tickets here.", { dept: dept.name })}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {tickets.map((ticket) => (
                  <TicketRow key={ticket.id} ticket={ticket} href={href({ t: String(ticket.number) })} selected={String(ticket.number) === open} today={today} />
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
            <Empty>{t("No {dept} tickets here.", { dept: dept.name })}</Empty>
          ) : (
            <TableWrap>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t("Title")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("Priority")}</th>
                    <th>{t("Requester")}</th>
                    <th>{t("Assignee")}</th>
                    <th>{t("Due")}</th>
                    <th>{t("Opened")}</th>
                    <th>{t("Last reply")}</th>
                    <th>{t("Updated")}</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-panel-muted">
                      <td className="text-dim tabular-nums">{ticket.number}</td>
                      <td className="max-w-80">
                        <Link href={href({ t: String(ticket.number) })} scroll={false} className="font-medium hover:underline">
                          {ticket.title}
                        </Link>
                        {ticket.location && <div className="text-xs text-dim">{ticket.location.name}</div>}
                      </td>
                      <td>
                        <Badge value={ticket.status} />
                      </td>
                      <td>
                        <Badge value={ticket.priority} />
                      </td>
                      <td className="whitespace-nowrap">{ticket.requester.name}</td>
                      <td className="text-dim">{ticket.assignees.map((a) => a.user.name).join(", ") || "—"}</td>
                      <td
                        className={cn(
                          "whitespace-nowrap",
                          ticket.dueAt && ACTIVE_STATUSES.includes(ticket.status) && ticket.dueAt < today ? "font-medium text-red-600 dark:text-red-400" : "text-dim",
                        )}
                      >
                        {ticket.dueAt ? fmtDate(ticket.dueAt, locale) : "—"}
                      </td>
                      <td className="whitespace-nowrap text-dim">{fmtDateTime(ticket.createdAt, locale)}</td>
                      <td className="whitespace-nowrap">
                        <LastReply ticket={ticket} />
                      </td>
                      <td className="whitespace-nowrap text-dim">{fmtRelative(ticket.updatedAt, locale)}</td>
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

async function LastReply({
  ticket,
}: {
  ticket: { status: string; requesterId: string; activity: { authorId: string | null; createdAt: Date; author: { name: string } | null }[] };
}) {
  const { t, locale } = await getI18n();
  const reply = ticket.activity[0];
  if (!reply) return <span className="text-dim">{t("No replies yet")}</span>;
  const fromRequester = reply.authorId === ticket.requesterId;
  return (
    <>
      <div className="flex items-center gap-2">
        {reply.author?.name ?? t("Deleted user")}
        {ACTIVE_STATUSES.includes(ticket.status) && ticket.status !== "standby" && (
          <Badge tone={fromRequester ? "amber" : "green"}>{fromRequester ? t("Awaiting staff") : t("Staff replied")}</Badge>
        )}
      </div>
      <div className="text-xs text-dim">{fmtRelative(reply.createdAt, locale)}</div>
    </>
  );
}

/** A compact list entry for the side list while a ticket is open in the reading pane. */
async function TicketRow({
  ticket,
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
  const { t, locale } = await getI18n();
  const overdue = ticket.dueAt && ACTIVE_STATUSES.includes(ticket.status) && ticket.dueAt < today;
  return (
    <li>
      <Link
        href={href}
        scroll={false}
        aria-current={selected ? "page" : undefined}
        className={cn("block border-l-2 px-4 py-3 text-sm", selected ? "border-accent bg-panel-muted" : "border-transparent hover:bg-panel-muted")}
      >
        <div className="flex items-center gap-2 text-xs text-dim">
          <span className="tabular-nums">#{ticket.number}</span>
          <span className="min-w-0 truncate">{ticket.requester.name}</span>
          <span className="ml-auto shrink-0">{fmtRelative(ticket.updatedAt, locale)}</span>
        </div>
        <div className="mt-0.5 truncate font-medium">{ticket.title}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge value={ticket.status} />
          {ticket.priority !== "normal" && <Badge value={ticket.priority} />}
          {overdue && <span className="text-xs font-medium text-red-600 dark:text-red-400">{t("Overdue")}</span>}
          {ticket.location && <span className="min-w-0 truncate text-xs text-dim">{ticket.location.name}</span>}
        </div>
      </Link>
    </li>
  );
}
