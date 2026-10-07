import Link from "next/link";
import { Package, Plus, UserCheck } from "lucide-react";
import { Badge, DeptBadge, Empty, PageHeader, Section, Stat } from "@/components/ui";
import { isAgent, isReception, requireUser } from "@/lib/auth";
import { fmtRelative, startOfToday } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ACTIVE_STATUSES, lowStockCount } from "@/lib/tickets";

export default async function Dashboard() {
  const user = await requireUser();
  const agent = isAgent(user);
  const reception = isReception(user);
  const today = startOfToday();
  const queueWhere = user.isAdmin && !user.departmentIds.length ? {} : { departmentId: { in: user.departmentIds } };

  const [myOpen, myDeliveries, queue] = await Promise.all([
    prisma.ticket.findMany({
      where: { requesterId: user.id, status: { in: ACTIVE_STATUSES } },
      include: { department: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.delivery.count({ where: { recipientId: user.id, status: "received" } }),
    agent
      ? Promise.all([
          prisma.ticket.count({ where: { ...queueWhere, status: "open", assigneeId: null } }),
          prisma.ticket.count({ where: { assigneeId: user.id, status: { in: ACTIVE_STATUSES } } }),
          prisma.ticket.count({ where: { ...queueWhere, status: { in: ACTIVE_STATUSES }, priority: "urgent" } }),
          lowStockCount(user.isAdmin ? undefined : user.departmentIds),
          // One list per department: tickets of different departments are never mixed.
          prisma.department.findMany({
            where: { takesTickets: true, ...(user.isAdmin && !user.departmentIds.length ? {} : { id: { in: user.departmentIds } }) },
            orderBy: { name: "asc" },
            include: {
              tickets: { where: { status: { in: ACTIVE_STATUSES } }, orderBy: [{ updatedAt: "desc" }], take: 6 },
            },
          }),
        ])
      : null,
  ]);

  const desk = reception
    ? await Promise.all([
        prisma.visitor.count({ where: { checkedInAt: { not: null }, checkedOutAt: null } }),
        prisma.visitor.count({ where: { checkedInAt: null, expectedAt: { gte: today, lt: new Date(today.getTime() + 864e5) } } }),
        prisma.delivery.count({ where: { status: "received" } }),
      ])
    : null;

  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Hello, ${firstName}`}
        subtitle="What needs attention today"
        actions={
          <Link href="/tickets/new" className="btn btn-primary">
            <Plus className="size-4" /> New ticket
          </Link>
        }
      />

      {myDeliveries > 0 && (
        <Link href="/deliveries" className="mb-6 flex items-center gap-3 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          <Package className="size-5" />
          You have {myDeliveries} deliver{myDeliveries === 1 ? "y" : "ies"} waiting at reception.
        </Link>
      )}

      {queue && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Unassigned in queue" value={queue[0]} href="/tickets?view=queue" />
          <Stat label="Assigned to me" value={queue[1]} href="/tickets?view=assigned" />
          <Stat label="Urgent open" value={queue[2]} tone={queue[2] ? "red" : undefined} href="/tickets?view=queue" />
          <Stat label="Supplies low" value={queue[3]} tone={queue[3] ? "amber" : undefined} href="/inventory/supplies" />
        </div>
      )}

      {desk && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <Stat label="Visitors on site" value={desk[0]} href="/visitors" />
          <Stat label="Still expected today" value={desk[1]} href="/visitors" />
          <Stat label="Parcels on the shelf" value={desk[2]} href="/deliveries" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {queue?.[4].map((d) => (
          <Section
            key={d.id}
            title={<DeptBadge dept={d} />}
            actions={
              <Link href={`/tickets?dept=${d.slug}`} className="link text-xs">
                All
              </Link>
            }
            className="lg:col-span-2"
          >
            {d.tickets.length === 0 ? (
              <Empty>{d.name} queue is empty. 🎉</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {d.tickets.map((t) => (
                  <li key={t.id}>
                    <Link href={`/tickets/${t.number}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm hover:bg-panel-muted">
                      <span className="text-dim tabular-nums">#{t.number}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                      <Badge value={t.priority} />
                      <Badge value={t.status} />
                      <span className="w-20 text-right text-xs text-dim">{fmtRelative(t.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ))}

        <Section title="My open requests" actions={<Link href="/tickets?view=mine" className="link text-xs">All</Link>}>
          {myOpen.length === 0 ? (
            <Empty>You have no open tickets.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {myOpen.map((t) => (
                <li key={t.id}>
                  <Link href={`/tickets/${t.number}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-panel-muted">
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <DeptBadge dept={t.department} />
                    <Badge value={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {!reception && (
          <Section title="Expecting a visitor?" className="lg:col-span-2">
            <div className="flex items-center justify-between gap-3 p-4 text-sm text-dim">
              <span className="flex items-center gap-2">
                <UserCheck className="size-4" /> Pre-register them so reception has their badge ready.
              </span>
              <Link href="/visitors" className="btn">
                Register visitor
              </Link>
            </div>
          </Section>
        )}
      </div>
    </>
  );
}
