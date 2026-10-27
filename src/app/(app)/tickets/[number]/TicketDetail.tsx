import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, SquareKanban, Maximize2, Plus, X } from "lucide-react";
import { Badge, DeptBadge, Empty, Field, PageHeader, Section, toneClasses } from "@/components/ui";
import { isAgentOf, requireUser } from "@/lib/auth";
import { canUseBoard } from "@/lib/boardAccess";
import { fmtDate, fmtDateTime, fmtRelative, label, startOfToday, TICKET_PRIORITIES, TICKET_STATUSES, toLocalInput } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canViewTicket } from "@/lib/tickets";
import { cn } from "@/lib/utils";
import { activityText } from "@/i18n/activity";
import { getI18n } from "@/i18n/server";
import { addComment, addTicketToBoard, closeOwnTicket, takeTicket, updateTicket, consumeSupply } from "../actions";
import { StatusPills } from "./StatusPills";

/**
 * A ticket's description, activity and agent controls. Rendered as its own page, or as the
 * reading pane next to the ticket list (`pane` holds that pane's close link).
 */
export async function TicketDetail({ number, pane }: { number: number; pane?: { closeHref: string } }) {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  // In the pane a stale link shouldn't take the whole list down with it.
  const missing = () => (pane ? <Empty>{t("Ticket #{number} not found.", { number })}</Empty> : notFound());
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
      cards: { include: { list: { include: { board: { include: { department: true } } } } }, orderBy: { createdAt: "asc" } },
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
  // Cards on boards this user can open: their own board and the shared ones.
  const cards = ticket.cards.filter((c) => canUseBoard(user, c.list.board));
  const onMyBoard = cards.some((c) => c.list.board.ownerId === user.id);
  const onDeptBoard = cards.some((c) => c.list.board.departmentId === ticket.departmentId);
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
              {t("opened by {name}", { name: ticket.requester.name })} · {fmtRelative(ticket.createdAt, locale)}
            </span>
          </span>
        }
        actions={
          <>
            {pane && (
              <>
                <Link href={`/tickets/${ticket.number}`} className="btn" title={t("Open as a full page")}>
                  <Maximize2 className="size-4" />
                </Link>
                <Link href={pane.closeHref} scroll={false} className="btn" title={t("Close")}>
                  <X className="size-4" />
                </Link>
              </>
            )}
            {agent && !assigneeIds.includes(user.id) && open && (
              <form action={takeTicket.bind(null, ticket.id)}>
                <button className="btn btn-primary">{assigneeIds.length ? t("Join") : t("Take it")}</button>
              </form>
            )}
            {ticket.requesterId === user.id && ticket.status !== "closed" && (
              <form action={closeOwnTicket.bind(null, ticket.id)}>
                <button className="btn">{t("Mark as solved & close")}</button>
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

          <Section title={t("Activity")}>
            <ol className="divide-y divide-line">
              {activity.map((a) =>
                a.kind === "event" ? (
                  <li key={a.id} className="px-5 py-2 text-xs text-dim">
                    <span className="font-medium text-fg">{a.author?.name ?? t("System")}</span> {activityText(a.body, locale)} · {fmtDateTime(a.createdAt, locale)}
                  </li>
                ) : (
                  <li key={a.id} className={cn("px-5 py-4", a.kind === "note" && "bg-amber-500/5")}>
                    <div className="mb-1 flex items-center gap-2 text-xs text-dim">
                      <span className="font-medium text-fg">{a.author?.name ?? t("Unknown")}</span>
                      {fmtDateTime(a.createdAt, locale)}
                      {a.kind === "note" && <Badge tone="amber">{t("Internal note")}</Badge>}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{a.body}</div>
                  </li>
                ),
              )}
            </ol>
            <form action={addComment.bind(null, ticket.id)} className="space-y-2 border-t border-line p-4">
              <textarea name="body" required rows={3} placeholder={t("Write a reply…")} className="input" />
              <div className="flex items-center justify-between gap-2">
                {agent ? (
                  <label className="flex items-center gap-2 text-xs text-dim">
                    <input type="checkbox" name="internal" /> {t("Internal note (only agents see it)")}
                  </label>
                ) : (
                  <span />
                )}
                <button className="btn btn-primary">{t("Send")}</button>
              </div>
            </form>
          </Section>
        </div>

        <aside className="space-y-6">
          {agent ? (
            <Section title={t("Manage")}>
              <form action={updateTicket.bind(null, ticket.id)} className="space-y-3 p-4">
                <div>
                  <span className="label">{t("Status")}</span>
                  <StatusPills
                    key={ticket.status}
                    name="status"
                    defaultValue={ticket.status}
                    options={TICKET_STATUSES.map((s) => ({ value: s, label: label(s, locale), className: toneClasses(s) }))}
                  />
                </div>
                <Field label={t("Priority")}>
                  <select name="priority" defaultValue={ticket.priority} className="input">
                    {TICKET_PRIORITIES.map((s) => (
                      <option key={s} value={s}>
                        {label(s, locale)}
                      </option>
                    ))}
                  </select>
                </Field>
                <div>
                  <span className="label">{t("Assigned to")}</span>
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
                        {a.id === user.id && <span className="text-xs text-dim">{t("(me)")}</span>}
                      </label>
                    ))}
                  </div>
                </div>
                <Field label={t("Due date")}>
                  <input name="dueAt" type="date" defaultValue={toLocalInput(ticket.dueAt).slice(0, 10)} className="input" />
                </Field>
                <Field label={t("Category")}>
                  <select name="categoryId" defaultValue={ticket.categoryId ?? ""} className="input">
                    <option value="">—</option>
                    {ticket.department.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Department")}>
                  <select name="departmentId" defaultValue={ticket.departmentId} className="input">
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <button className="btn btn-primary w-full">{t("Save")}</button>
              </form>
            </Section>
          ) : null}

          <Section title={t("Details")}>
            <dl className="space-y-3 p-4 text-sm">
              <Detail term={t("Requester")}>
                {ticket.requester.name}
                <div className="text-xs text-dim">{ticket.requester.email}</div>
              </Detail>
              <Detail term={ticket.assignees.length > 1 ? t("Assignees") : t("Assignee")}>
                {ticket.assignees.length ? ticket.assignees.map((a) => <div key={a.userId}>{a.user.name}</div>) : t("Unassigned")}
              </Detail>
              <Detail term={t("Category")}>{ticket.category?.name ?? "—"}</Detail>
              <Detail term={t("Location")}>{ticket.location?.name ?? "—"}</Detail>
              {ticket.asset && (
                <Detail term={t("Asset")}>
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
                <Detail term={t("Event")}>
                  <Link href={`/events/${ticket.event.id}`} className="link">
                    {ticket.event.title}
                  </Link>
                  <div className="text-xs text-dim">{fmtDateTime(ticket.event.startsAt, locale)}</div>
                </Detail>
              )}
              {ticket.dueAt && (
                <Detail term={t("Due")}>
                  <span className={cn(open && ticket.dueAt < startOfToday() && "font-medium text-red-600 dark:text-red-400")}>
                    {fmtDate(ticket.dueAt, locale)}
                    {open && ticket.dueAt < startOfToday() && ` · ${t("overdue")}`}
                  </span>
                </Detail>
              )}
              <Detail term={t("Opened")}>{fmtDateTime(ticket.createdAt, locale)}</Detail>
              {ticket.resolvedAt && <Detail term={t("Resolved")}>{fmtDateTime(ticket.resolvedAt, locale)}</Detail>}
            </dl>
          </Section>

          <Section title={t("Boards")}>
            <div className="space-y-2 p-4 text-sm">
              {cards.map((c) => {
                const board = c.list.board;
                const href = `${board.department ? `/boards/${board.department.slug}` : "/boards"}?card=${c.id}`;
                return (
                  <Link key={c.id} href={href} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 hover:border-accent/40">
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ background: board.color }} />
                    <span className="min-w-0 flex-1 truncate">
                      {board.ownerId ? t("My board") : board.title}
                      <span className="text-dim"> · {c.list.title}</span>
                    </span>
                    {c.done && <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                  </Link>
                );
              })}
              {(!onMyBoard || (agent && !onDeptBoard)) && (
                <form action={addTicketToBoard.bind(null, ticket.id)} className="flex gap-2">
                  <select name="board" className="input min-w-0" defaultValue={agent && !onDeptBoard ? "department" : "mine"}>
                    {agent && !onDeptBoard && <option value="department">{ticket.department.name}</option>}
                    {!onMyBoard && <option value="mine">{t("My board")}</option>}
                  </select>
                  <button className="btn shrink-0">
                    <Plus className="size-4" /> {t("Add to board")}
                  </button>
                </form>
              )}
              {!cards.length && (
                <p className="flex items-center gap-1.5 text-xs text-dim">
                  <SquareKanban className="size-3.5" /> {t("Not on any board yet")}
                </p>
              )}
            </div>
          </Section>

          {agent && supplies.length > 0 && (
            <Section title={t("Use supplies")}>
              <form action={consumeSupply.bind(null, ticket.id)} className="flex gap-2 p-4">
                <select name="supplyId" required className="input min-w-0">
                  {supplies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.quantity})
                    </option>
                  ))}
                </select>
                <input name="quantity" type="number" min={1} defaultValue={1} className="input w-16" />
                <button className="btn">{t("Use")}</button>
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
