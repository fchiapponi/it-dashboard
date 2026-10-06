import Link from "next/link";
import { Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma";
import { Badge, DeptBadge, Empty, FilterTabs, PageHeader, Section, TableWrap } from "@/components/ui";
import { isAgent, requireUser } from "@/lib/auth";
import { fmtRelative } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ACTIVE_STATUSES, visibleTickets } from "@/lib/tickets";

const VIEWS = ["queue", "assigned", "mine", "all"] as const;

export default async function TicketsPage({ searchParams }: PageProps<"/tickets">) {
  const user = await requireUser();
  const sp = await searchParams;
  const agent = isAgent(user);
  const view = VIEWS.find((v) => v === sp.view) ?? (agent ? "queue" : "mine");
  const state = sp.state === "done" ? "done" : sp.state === "any" ? "any" : "active";
  const dept = typeof sp.dept === "string" ? sp.dept : null;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const where: Prisma.TicketWhereInput[] = [visibleTickets(user)];
  if (view === "queue") where.push(user.isAdmin && !user.departmentIds.length ? {} : { departmentId: { in: user.departmentIds } });
  if (view === "assigned") where.push({ assigneeId: user.id });
  if (view === "mine") where.push({ requesterId: user.id });
  if (state === "active") where.push({ status: { in: ACTIVE_STATUSES } });
  if (state === "done") where.push({ status: { notIn: ACTIVE_STATUSES } });
  if (dept) where.push({ department: { slug: dept } });
  if (q) {
    const n = Number.parseInt(q.replace(/^#/, ""), 10);
    where.push({ OR: [{ title: { contains: q } }, { description: { contains: q } }, ...(Number.isFinite(n) ? [{ number: n }] : [])] });
  }

  const [tickets, departments] = await Promise.all([
    prisma.ticket.findMany({
      where: { AND: where },
      include: { department: true, requester: true, assignee: true, location: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    }),
    prisma.department.findMany({ where: { takesTickets: true }, orderBy: { name: "asc" } }),
  ]);

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { view, state, dept, q: q || null, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/tickets?${p}`;
  };

  const viewTabs = [
    ...(agent
      ? [
          { key: "queue", label: "Department queue", href: href({ view: "queue" }) },
          { key: "assigned", label: "Assigned to me", href: href({ view: "assigned" }) },
        ]
      : []),
    { key: "mine", label: "My requests", href: href({ view: "mine" }) },
    ...(agent ? [{ key: "all", label: "All visible", href: href({ view: "all" }) }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Tickets"
        subtitle="Requests to IT and Facilities"
        actions={
          <Link href="/tickets/new" className="btn btn-primary">
            <Plus className="size-4" /> New ticket
          </Link>
        }
      />
      <FilterTabs items={viewTabs} active={view} />

      <form className="mb-4 flex flex-wrap gap-2" action="/tickets">
        <input type="hidden" name="view" value={view} />
        <input name="q" defaultValue={q} placeholder="Search title or #number" className="input max-w-xs" />
        <select name="state" defaultValue={state} className="input w-auto">
          <option value="active">Active</option>
          <option value="done">Resolved / closed</option>
          <option value="any">Any status</option>
        </select>
        <select name="dept" defaultValue={dept ?? ""} className="input w-auto">
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
        <button className="btn">Filter</button>
      </form>

      <Section>
        {tickets.length === 0 ? (
          <Empty>No tickets here.</Empty>
        ) : (
          <TableWrap>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Requester</th>
                  <th>Assignee</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-panel-muted">
                    <td className="text-dim tabular-nums">{t.number}</td>
                    <td className="max-w-80">
                      <Link href={`/tickets/${t.number}`} className="font-medium hover:underline">
                        {t.title}
                      </Link>
                      {t.location && <div className="text-xs text-dim">{t.location.name}</div>}
                    </td>
                    <td>
                      <DeptBadge dept={t.department} />
                    </td>
                    <td>
                      <Badge value={t.status} />
                    </td>
                    <td>
                      <Badge value={t.priority} />
                    </td>
                    <td className="whitespace-nowrap">{t.requester.name}</td>
                    <td className="whitespace-nowrap text-dim">{t.assignee?.name ?? "—"}</td>
                    <td className="whitespace-nowrap text-dim">{fmtRelative(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>
    </>
  );
}
