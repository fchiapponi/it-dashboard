import Link from "next/link";
import { Plus } from "lucide-react";
import { DeptBadge, PageHeader, Stat } from "@/components/ui";
import { isAgent, isReception, requireUser } from "@/lib/auth";
import { startOfToday } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ACTIVE_STATUSES, lowStockCount } from "@/lib/tickets";

/** Numbers only: each tile links to the list behind it. */
export default async function Dashboard() {
  const user = await requireUser();
  const agent = isAgent(user);
  const reception = isReception(user);
  const today = startOfToday();
  const active = { status: { in: ACTIVE_STATUSES } };

  // Departments whose queue the user works, each shown separately: tickets of different departments are never mixed.
  const departments = agent
    ? await prisma.department.findMany({
        where: { takesTickets: true, ...(user.isAdmin && !user.departmentIds.length ? {} : { id: { in: user.departmentIds } }) },
        orderBy: { name: "asc" },
      })
    : [];
  const inDepts = { departmentId: { in: departments.map((d) => d.id) } };

  const [assignedToMe, myOpen, myDeliveries, lowStock, byStatus, unassigned, urgent, overdue] = await Promise.all([
    prisma.ticket.count({ where: { ...active, assignees: { some: { userId: user.id } } } }),
    prisma.ticket.count({ where: { ...active, requesterId: user.id } }),
    prisma.delivery.count({ where: { recipientId: user.id, status: "received" } }),
    agent ? lowStockCount(user.isAdmin ? undefined : user.departmentIds) : 0,
    prisma.ticket.groupBy({ by: ["departmentId", "status"], where: { ...inDepts, ...active }, _count: true }),
    prisma.ticket.groupBy({ by: ["departmentId"], where: { ...inDepts, ...active, assignees: { none: {} } }, _count: true }),
    prisma.ticket.groupBy({ by: ["departmentId"], where: { ...inDepts, ...active, priority: "urgent" }, _count: true }),
    prisma.ticket.groupBy({ by: ["departmentId"], where: { ...inDepts, ...active, dueAt: { lt: today } }, _count: true }),
  ]);

  const desk = reception
    ? await Promise.all([
        prisma.visitor.count({ where: { checkedInAt: { not: null }, checkedOutAt: null } }),
        prisma.visitor.count({ where: { checkedInAt: null, expectedAt: { gte: today, lt: new Date(today.getTime() + 864e5) } } }),
        prisma.delivery.count({ where: { status: "received" } }),
      ])
    : null;

  const countFor = (rows: { departmentId: string; _count: number }[], deptId: string) =>
    rows.find((r) => r.departmentId === deptId)?._count ?? 0;
  const statusCount = (deptId: string, status: string) =>
    byStatus.find((r) => r.departmentId === deptId && r.status === status)?._count ?? 0;

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

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {agent && <Stat label="Assigned to me" value={assignedToMe} href="/tickets?view=assigned" />}
        <Stat label="My open requests" value={myOpen} href="/tickets?view=mine" />
        <Stat label="Deliveries for me" value={myDeliveries} tone={myDeliveries ? "amber" : undefined} href="/deliveries" />
        {agent && <Stat label="Supplies low" value={lowStock} tone={lowStock ? "amber" : undefined} href="/inventory/supplies" />}
      </div>

      {departments.map((d) => {
        const q = (state: string) => `/tickets?dept=${d.slug}&state=${state}`;
        const n = {
          open: statusCount(d.id, "open"),
          inProgress: statusCount(d.id, "in_progress"),
          waiting: statusCount(d.id, "waiting"),
          standby: statusCount(d.id, "standby"),
          unassigned: countFor(unassigned, d.id),
          urgent: countFor(urgent, d.id),
          overdue: countFor(overdue, d.id),
        };
        return (
          <section key={d.id} className="mb-8">
            <h2 className="mb-3 text-sm font-semibold">
              <DeptBadge dept={d} />
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <Stat label="Open" value={n.open} href={q("open")} />
              <Stat label="Unassigned" value={n.unassigned} tone={n.unassigned ? "amber" : undefined} href={q("active")} />
              <Stat label="In progress" value={n.inProgress} href={q("in_progress")} />
              <Stat label="Waiting" value={n.waiting} href={q("waiting")} />
              <Stat label="Standby" value={n.standby} href={q("standby")} />
              <Stat label="Urgent" value={n.urgent} tone={n.urgent ? "red" : undefined} href={q("active")} />
              <Stat label="Overdue" value={n.overdue} tone={n.overdue ? "red" : undefined} href={q("active")} />
            </div>
          </section>
        );
      })}

      {desk && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold">Reception</h2>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Visitors on site" value={desk[0]} href="/visitors" />
            <Stat label="Still expected today" value={desk[1]} href="/visitors" />
            <Stat label="Parcels on the shelf" value={desk[2]} href="/deliveries" />
          </div>
        </section>
      )}
    </>
  );
}
