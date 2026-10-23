import Link from "next/link";
import { Settings, Ticket, Trash2, User, Users } from "lucide-react";
import type { Board } from "@/generated/prisma";
import { Badge } from "@/components/Badge";
import { Field, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { BOARD_COLORS, CARD_COLORS, initials } from "@/lib/boards";
import { getDepartment } from "@/lib/department";
import { fmtDate, fmtDateTime, fmtRelative, startOfToday, toLocalInput } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canViewTicket } from "@/lib/tickets";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import { BoardView, type ListItem } from "./BoardView";
import { ColorPicker } from "./ColorPicker";
import { ConfirmButton } from "./ConfirmButton";
import { addCardComment, deleteCard, updateBoard, updateCard } from "./actions";
import { DialogShell } from "./DialogShell";

/** A board page: tabs to switch board, the board itself, and the open card's dialog. */
export async function BoardScreen({
  board,
  department,
  cardId,
}: {
  board: Board;
  department?: { id: string; name: string; slug: string };
  cardId: string | null;
}) {
  const { t, locale } = await getI18n();
  const user = await requireUser();
  const basePath = department ? `/boards/${department.slug}` : "/boards";

  const [full, current] = await Promise.all([
    prisma.board.findUniqueOrThrow({
      where: { id: board.id },
      include: {
        lists: {
          orderBy: { position: "asc" },
          include: {
            cards: {
              orderBy: { position: "asc" },
              include: { assignee: true, ticket: true, _count: { select: { comments: true } } },
            },
          },
        },
      },
    }),
    getDepartment(),
  ]);

  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 864e5);
  const lists: ListItem[] = full.lists.map((l) => ({
    id: l.id,
    title: l.title,
    cards: l.cards.map((c) => ({
      id: c.id,
      title: c.title,
      color: c.color,
      done: c.done,
      due: c.dueAt
        ? { label: fmtDate(c.dueAt, locale), state: c.dueAt < today ? "overdue" : c.dueAt < tomorrow ? "today" : "later" }
        : null,
      assignee: department && c.assignee ? { name: c.assignee.name, initials: initials(c.assignee.name) } : null,
      comments: c._count.comments,
      hasDescription: !!c.description,
      // Shared boards are open to everyone, so the ticket's status only shows to people who can see the ticket.
      ticket: c.ticket ? { number: c.ticket.number, status: canViewTicket(user, c.ticket) ? c.ticket.status : null } : null,
    })),
  }));

  // The picked department's board, plus another department's board when opened by link.
  const shared = [current, department?.id !== current?.id ? department : undefined].filter((d) => d != null);
  const tabs = [
    { href: "/boards", label: t("My board"), icon: User, active: !department },
    ...shared.map((d) => ({ href: `/boards/${d.slug}`, label: d.name, icon: Users, active: d.id === department?.id })),
  ];

  return (
    <>
      {tabs.length > 1 && (
        <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium",
                tab.active ? "border-accent text-fg" : "border-transparent text-dim hover:text-fg",
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </Link>
          ))}
        </div>
      )}

      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <span className="size-3.5 shrink-0 rounded" style={{ background: full.color }} />
            {full.title}
          </span>
        }
        subtitle={
          full.description ??
          (department
            ? t("{dept}'s shared board — everyone can see and edit it", { dept: department.name })
            : t("Your personal board — only you can see it"))
        }
        actions={
          <details className="relative">
            <summary className="btn cursor-pointer list-none">
              <Settings className="size-4" /> {t("Board settings")}
            </summary>
            <div className="card absolute right-0 z-20 mt-2 w-80 p-4 shadow-lg">
              <form action={updateBoard.bind(null, full.id)} className="grid gap-3">
                <Field label={t("Title")}>
                  <input name="title" required defaultValue={full.title} className="input" />
                </Field>
                <Field label={t("Description")}>
                  <input name="description" defaultValue={full.description ?? ""} className="input" />
                </Field>
                <div>
                  <span className="label">{t("Color")}</span>
                  <ColorPicker name="color" colors={BOARD_COLORS} defaultValue={full.color} />
                </div>
                <button className="btn btn-primary">{t("Save")}</button>
              </form>
            </div>
          </details>
        }
      />

      <BoardView boardId={full.id} basePath={basePath} lists={lists} />

      {cardId && <CardDialog cardId={cardId} boardId={full.id} basePath={basePath} lists={full.lists} department={department} />}
    </>
  );
}

async function CardDialog({
  cardId,
  boardId,
  basePath,
  lists,
  department,
}: {
  cardId: string;
  boardId: string;
  basePath: string;
  lists: { id: string; title: string }[];
  department?: { id: string };
}) {
  const { t, locale } = await getI18n();
  const user = await requireUser();
  const [card, members] = await Promise.all([
    prisma.card.findUnique({
      where: { id: cardId },
      include: {
        list: true,
        createdBy: true,
        ticket: true,
        comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    department
      ? prisma.user.findMany({
          where: { OR: [{ memberships: { some: { departmentId: department.id } } }, { role: "admin" }] },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [],
  ]);
  if (!card || card.list.boardId !== boardId) return null;
  const ticket = card.ticket && canViewTicket(user, card.ticket) ? card.ticket : null;

  return (
    <DialogShell closeHref={basePath}>
      {card.color && <div className="h-2 rounded-t-xl" style={{ background: card.color }} />}
      <div className="p-6">
        <p className="mb-3 pr-10 text-xs text-dim">
          {t("In list")} <span className="font-medium text-fg">{card.list.title}</span> ·{" "}
          {department ? t("created by {name}", { name: card.createdBy.name }) : t("created")} {fmtRelative(card.createdAt, locale)}
        </p>

        <form action={updateCard.bind(null, card.id)} className="grid gap-4">
          <Field label={t("Title")}>
            <input name="title" required defaultValue={card.title} className="input text-base font-medium" />
          </Field>

          {ticket && (
            <Link
              href={`/tickets/${ticket.number}`}
              className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:border-accent/40"
            >
              <Ticket className="size-4 shrink-0 text-dim" />
              <span className="text-dim">#{ticket.number}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{ticket.title}</span>
              <Badge value={ticket.status} />
            </Link>
          )}

          <div className={cn("grid gap-4", department ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            <Field label={t("List")}>
              <select name="listId" defaultValue={card.listId} className="input">
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </Field>
            {department && (
              <Field label={t("Assigned to")}>
                <select name="assigneeId" defaultValue={card.assigneeId ?? ""} className="input">
                  <option value="">—</option>
                  {members.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={t("Due date")}>
              <input name="dueAt" type="date" defaultValue={toLocalInput(card.dueAt).slice(0, 10)} className="input" />
            </Field>
          </div>

          <Field label={t("Linked ticket")}>
            <input
              name="ticketNumber"
              type="number"
              min={1}
              defaultValue={card.ticket?.number ?? ""}
              placeholder={t("Ticket number, e.g. 1042")}
              className="input"
            />
          </Field>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="label">{t("Label")}</span>
              <ColorPicker name="color" colors={CARD_COLORS} defaultValue={card.color} allowNone />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="done" defaultChecked={card.done} className="size-4 accent-accent" />
              {t("Done")}
            </label>
          </div>

          <Field label={t("Description")}>
            <textarea name="description" rows={5} defaultValue={card.description ?? ""} placeholder={t("Add more detail…")} className="input" />
          </Field>

          <div className="flex justify-end">
            <button className="btn btn-primary">{t("Save card")}</button>
          </div>
        </form>

        <div className="mt-6 border-t border-line pt-5">
          <h3 className="mb-3 text-sm font-semibold">{t("Comments")}</h3>
          {card.comments.length > 0 && (
            <ul className="mb-4 space-y-3">
              {card.comments.map((c) => (
                <li key={c.id} className="text-sm">
                  <div className="text-xs text-dim">
                    <span className="font-medium text-fg">{c.author?.name ?? t("Deleted user")}</span> · {fmtDateTime(c.createdAt, locale)}
                  </div>
                  <div className="mt-1 rounded-lg bg-panel-muted px-3 py-2 whitespace-pre-wrap">{c.body}</div>
                </li>
              ))}
            </ul>
          )}
          <form action={addCardComment.bind(null, card.id)} className="flex gap-2">
            <textarea name="body" required rows={1} placeholder={t("Write a comment…")} className="input" />
            <button className="btn self-start">{t("Send")}</button>
          </form>
        </div>

        <form action={deleteCard.bind(null, card.id)} className="mt-6 flex justify-end border-t border-line pt-4">
          <ConfirmButton message={t('Delete the card "{title}"?', { title: card.title })} className="btn btn-danger">
            <Trash2 className="size-4" /> {t("Delete card")}
          </ConfirmButton>
        </form>
      </div>
    </DialogShell>
  );
}
