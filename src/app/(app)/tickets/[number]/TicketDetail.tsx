import Link from "next/link";
import { notFound } from "next/navigation";
import { Maximize2, X } from "lucide-react";
import { Badge, DeptBadge, Empty, Field, PageHeader, Section, toneClasses } from "@/components/ui";
import { isAgentOf, requireUser } from "@/lib/auth";
import { fmtDate, fmtDateTime, fmtRelative, label, startOfToday, TICKET_PRIORITIES, TICKET_STATUSES, toLocalInput } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canViewTicket } from "@/lib/tickets";
import { cn } from "@/lib/utils";
import { addComment, closeOwnTicket, takeTicket, updateTicket, consumeSupply } from "../actions";
import { StatusPills } from "./StatusPills";

/**
 * A ticket's description, activity and agent controls. Rendered as its own page, or as the
 * reading pane next to the ticket list (`pane` holds that pane's close link).
 */
export async function TicketDetail({ number, pane }: { number: number; pane?: { closeHref: string } }) {
  const user = await requireUser();
  // In the pane a stale link shouldn't take the whole list down with it.
  const missing = () => (pane ? <Empty>Ticket #{number} not found.</Empty> : notFound());
  if (!Number.isFinite(number)) return missing();

  const ticket = await prisma.ticket.findUnique({
    where: { number },
    include: {
      department: { include: { categories: { orderBy: { name: "asc" } } } },
      category: true,
      location: true,
      requester: true,
      assignees: { include: { user: true }, orderBy: { createdAt: "asc" } },
      asset: true,
      event: true,
      activity: { include: { author: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket || !canViewTicket(user, ticket)) return missing();

  const agent = isAgentOf(user, ticket.departmentId);
  const assigneeIds = ticket.assignees.map((a) => a.userId);
  const [agents, departments, supplies] = agent
    ? await Promise.all([
        prisma.user.findMany({
          where: { OR: [{ memberships: { some: { departmentId: ticket.departmentId } } }, { id: { in: assigneeIds } }] },
          orderBy: { name: "asc" },
        }),
        prisma.department.findMany({ where: { takesTickets: true }, orderBy: { name: "asc" } }),
        prisma.supply.findMany({ where: { departmentId: ticket.departmentId, quantity: { gt: 0 } }, orderBy: { name: "asc" } }),
      ])
    : [[], [], []];

  const activity = ticket.activity.filter((a) => agent || a.kind !== "note");
  const open = !["resolved", "closed"].includes(ticket.status);

  return (
    // Sized by its own width, so the reading pane stacks the sidebar under the activity.
    <div className="@container">
      <PageHeader
        title={
          <>
            <span className="text-dim">#{ticket.number}</span> {ticket.title}
          </>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <DeptBadge dept={ticket.department} />
            <Badge value={ticket.status} />
            <Badge value={ticket.priority} />
            <span>
              opened by {ticket.requester.name} · {fmtRelative(ticket.createdAt)}
            </span>
          </span>
        }
        actions={
          <>
            {pane && (
              <>
                <Link href={`/tickets/${ticket.number}`} className="btn" title="Open as a full page">
                  <Maximize2 className="size-4" />
                </Link>
                <Link href={pane.closeHref} scroll={false} className="btn" title="Close">
                  <X className="size-4" />
                </Link>
              </>
            )}
            {agent && !assigneeIds.includes(user.id) && open && (
              <form action={takeTicket.bind(null, ticket.id)}>
                <button className="btn btn-primary">{assigneeIds.length ? "Join" : "Take it"}</button>
              </form>
            )}
            {ticket.requesterId === user.id && ticket.status !== "closed" && (
              <form action={closeOwnTicket.bind(null, ticket.id)}>
                <button className="btn">Mark as solved & close</button>
              </form>
            )}
          </>
        }
      />

      <div className="grid gap-6 @3xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          <Section>
            <div className="p-5 text-sm whitespace-pre-wrap">{ticket.description}</div>
          </Section>

          <Section title="Activity">
            <ol className="divide-y divide-line">
              {activity.map((a) =>
                a.kind === "event" ? (
                  <li key={a.id} className="px-5 py-2 text-xs text-dim">
                    <span className="font-medium text-fg">{a.author?.name ?? "System"}</span> {a.body} · {fmtDateTime(a.createdAt)}
                  </li>
                ) : (
                  <li key={a.id} className={cn("px-5 py-4", a.kind === "note" && "bg-amber-500/5")}>
                    <div className="mb-1 flex items-center gap-2 text-xs text-dim">
                      <span className="font-medium text-fg">{a.author?.name ?? "Unknown"}</span>
                      {fmtDateTime(a.createdAt)}
                      {a.kind === "note" && <Badge tone="amber">Internal note</Badge>}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{a.body}</div>
                  </li>
                ),
              )}
            </ol>
            <form action={addComment.bind(null, ticket.id)} className="space-y-2 border-t border-line p-4">
              <textarea name="body" required rows={3} placeholder="Write a reply…" className="input" />
              <div className="flex items-center justify-between gap-2">
                {agent ? (
                  <label className="flex items-center gap-2 text-xs text-dim">
                    <input type="checkbox" name="internal" /> Internal note (only agents see it)
                  </label>
                ) : (
                  <span />
                )}
                <button className="btn btn-primary">Send</button>
              </div>
            </form>
          </Section>
        </div>

        <aside className="space-y-6">
          {agent ? (
            <Section title="Manage">
              <form action={updateTicket.bind(null, ticket.id)} className="space-y-3 p-4">
                <div>
                  <span className="label">Status</span>
                  <StatusPills
                    key={ticket.status}
                    name="status"
                    defaultValue={ticket.status}
                    options={TICKET_STATUSES.map((s) => ({ value: s, label: label(s), className: toneClasses(s) }))}
                  />
                </div>
                <Field label="Priority">
                  <select name="priority" defaultValue={ticket.priority} className="input">
                    {TICKET_PRIORITIES.map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </Field>
                <div>
                  <span className="label">Assigned to</span>
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-line p-2" key={assigneeIds.join()}>
                    {agents.map((a) => (
                      <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-panel-muted">
                        <input
                          type="checkbox"
                          name="assigneeIds"
                          value={a.id}
                          defaultChecked={assigneeIds.includes(a.id)}
                          className="size-4 accent-accent"
                        />
                        {a.name}
                        {a.id === user.id && <span className="text-xs text-dim">(me)</span>}
                      </label>
                    ))}
                  </div>
                </div>
                <Field label="Due date">
                  <input name="dueAt" type="date" defaultValue={toLocalInput(ticket.dueAt).slice(0, 10)} className="input" />
                </Field>
                <Field label="Category">
                  <select name="categoryId" defaultValue={ticket.categoryId ?? ""} className="input">
                    <option value="">—</option>
                    {ticket.department.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Department">
                  <select name="departmentId" defaultValue={ticket.departmentId} className="input">
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <button className="btn btn-primary w-full">Save</button>
              </form>
            </Section>
          ) : null}

          <Section title="Details">
            <dl className="space-y-3 p-4 text-sm">
              <Detail term="Requester">
                {ticket.requester.name}
                <div className="text-xs text-dim">{ticket.requester.email}</div>
              </Detail>
              <Detail term={ticket.assignees.length > 1 ? "Assignees" : "Assignee"}>
                {ticket.assignees.length ? ticket.assignees.map((a) => <div key={a.userId}>{a.user.name}</div>) : "Unassigned"}
              </Detail>
              <Detail term="Category">{ticket.category?.name ?? "—"}</Detail>
              <Detail term="Location">{ticket.location?.name ?? "—"}</Detail>
              {ticket.asset && (
                <Detail term="Asset">
                  {agent ? (
                    <Link href={`/inventory/${ticket.asset.tag}`} className="link">
                      {ticket.asset.tag} · {ticket.asset.name}
                    </Link>
                  ) : (
                    `${ticket.asset.tag} · ${ticket.asset.name}`
                  )}
                </Detail>
              )}
              {ticket.event && (
                <Detail term="Event">
                  <Link href={`/events/${ticket.event.id}`} className="link">
                    {ticket.event.title}
                  </Link>
                  <div className="text-xs text-dim">{fmtDateTime(ticket.event.startsAt)}</div>
                </Detail>
              )}
              {ticket.dueAt && (
                <Detail term="Due">
                  <span className={cn(open && ticket.dueAt < startOfToday() && "font-medium text-red-600 dark:text-red-400")}>
                    {fmtDate(ticket.dueAt)}
                    {open && ticket.dueAt < startOfToday() && " · overdue"}
                  </span>
                </Detail>
              )}
              <Detail term="Opened">{fmtDateTime(ticket.createdAt)}</Detail>
              {ticket.resolvedAt && <Detail term="Resolved">{fmtDateTime(ticket.resolvedAt)}</Detail>}
            </dl>
          </Section>

          {agent && supplies.length > 0 && (
            <Section title="Use supplies">
              <form action={consumeSupply.bind(null, ticket.id)} className="flex gap-2 p-4">
                <select name="supplyId" required className="input min-w-0">
                  {supplies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.quantity})
                    </option>
                  ))}
                </select>
                <input name="quantity" type="number" min={1} defaultValue={1} className="input w-16" />
                <button className="btn">Use</button>
              </form>
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-dim">{term}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
