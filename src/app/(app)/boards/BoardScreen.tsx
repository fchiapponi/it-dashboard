import Link from "next/link";
import { Settings, Trash2, User, Users } from "lucide-react";
import type { Board } from "@/generated/prisma";
import { Field, PageHeader } from "@/components/ui";
import { boardDepartments } from "@/lib/boardAccess";
import { BOARD_COLORS, CARD_COLORS, initials } from "@/lib/boards";
import { fmtDate, fmtDateTime, fmtRelative, startOfToday, toLocalInput } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
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
  const basePath = department ? `/boards/${department.slug}` : "/boards";

  const [full, departments] = await Promise.all([
    prisma.board.findUniqueOrThrow({
      where: { id: board.id },
      include: {
        lists: {
          orderBy: { position: "asc" },
          include: {
            cards: {
              orderBy: { position: "asc" },
              include: { assignee: true, _count: { select: { comments: true } } },
            },
          },
        },
      },
    }),
    boardDepartments(),
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
        ? { label: fmtDate(c.dueAt), state: c.dueAt < today ? "overdue" : c.dueAt < tomorrow ? "today" : "later" }
        : null,
      assignee: department && c.assignee ? { name: c.assignee.name, initials: initials(c.assignee.name) } : null,
      comments: c._count.comments,
      hasDescription: !!c.description,
    })),
  }));

  const tabs = [
    { href: "/boards", label: "My board", icon: User, active: !department },
    ...departments.map((d) => ({ href: `/boards/${d.slug}`, label: d.name, icon: Users, active: d.id === department?.id })),
  ];

  return (
    <>
      {tabs.length > 1 && (
        <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium",
                t.active ? "border-accent text-fg" : "border-transparent text-dim hover:text-fg",
              )}
            >
              <t.icon className="size-4" />
              {t.label}
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
          (department ? `${department.name}'s shared board — everyone can see and edit it` : "Your personal board — only you can see it")
        }
        actions={
          <details className="relative">
            <summary className="btn cursor-pointer list-none">
              <Settings className="size-4" /> Board settings
            </summary>
            <div className="card absolute right-0 z-20 mt-2 w-80 p-4 shadow-lg">
              <form action={updateBoard.bind(null, full.id)} className="grid gap-3">
                <Field label="Title">
                  <input name="title" required defaultValue={full.title} className="input" />
                </Field>
                <Field label="Description">
                  <input name="description" defaultValue={full.description ?? ""} className="input" />
                </Field>
                <div>
                  <span className="label">Color</span>
                  <ColorPicker name="color" colors={BOARD_COLORS} defaultValue={full.color} />
                </div>
                <button className="btn btn-primary">Save</button>
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
  const [card, members] = await Promise.all([
    prisma.card.findUnique({
      where: { id: cardId },
      include: { list: true, createdBy: true, comments: { include: { author: true }, orderBy: { createdAt: "asc" } } },
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

  return (
    <DialogShell closeHref={basePath}>
      {card.color && <div className="h-2 rounded-t-xl" style={{ background: card.color }} />}
      <div className="p-6">
        <p className="mb-3 pr-10 text-xs text-dim">
          In list <span className="font-medium text-fg">{card.list.title}</span> · created
          {department && ` by ${card.createdBy.name}`} {fmtRelative(card.createdAt)}
        </p>

        <form action={updateCard.bind(null, card.id)} className="grid gap-4">
          <Field label="Title">
            <input name="title" required defaultValue={card.title} className="input text-base font-medium" />
          </Field>

          <div className={cn("grid gap-4", department ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            <Field label="List">
              <select name="listId" defaultValue={card.listId} className="input">
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </Field>
            {department && (
              <Field label="Assigned to">
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
            <Field label="Due date">
              <input name="dueAt" type="date" defaultValue={toLocalInput(card.dueAt).slice(0, 10)} className="input" />
            </Field>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="label">Label</span>
              <ColorPicker name="color" colors={CARD_COLORS} defaultValue={card.color} allowNone />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="done" defaultChecked={card.done} className="size-4 accent-accent" />
              Done
            </label>
          </div>

          <Field label="Description">
            <textarea name="description" rows={5} defaultValue={card.description ?? ""} placeholder="Add more detail…" className="input" />
          </Field>

          <div className="flex justify-end">
            <button className="btn btn-primary">Save card</button>
          </div>
        </form>

        <div className="mt-6 border-t border-line pt-5">
          <h3 className="mb-3 text-sm font-semibold">Comments</h3>
          {card.comments.length > 0 && (
            <ul className="mb-4 space-y-3">
              {card.comments.map((c) => (
                <li key={c.id} className="text-sm">
                  <div className="text-xs text-dim">
                    <span className="font-medium text-fg">{c.author?.name ?? "Deleted user"}</span> · {fmtDateTime(c.createdAt)}
                  </div>
                  <div className="mt-1 rounded-lg bg-panel-muted px-3 py-2 whitespace-pre-wrap">{c.body}</div>
                </li>
              ))}
            </ul>
          )}
          <form action={addCardComment.bind(null, card.id)} className="flex gap-2">
            <textarea name="body" required rows={1} placeholder="Write a comment…" className="input" />
            <button className="btn self-start">Send</button>
          </form>
        </div>

        <form action={deleteCard.bind(null, card.id)} className="mt-6 flex justify-end border-t border-line pt-4">
          <ConfirmButton message={`Delete the card "${card.title}"?`} className="btn btn-danger">
            <Trash2 className="size-4" /> Delete card
          </ConfirmButton>
        </form>
      </div>
    </DialogShell>
  );
}
