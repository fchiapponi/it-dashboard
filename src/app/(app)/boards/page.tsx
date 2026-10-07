import { Settings, Trash2 } from "lucide-react";
import { Field, PageHeader } from "@/components/ui";
import { BOARD_COLORS, CARD_COLORS } from "@/lib/boards";
import { fmtDate, fmtDateTime, fmtRelative, startOfToday, toLocalInput } from "@/lib/format";
import { myBoardId } from "@/lib/myBoard";
import { prisma } from "@/lib/prisma";
import { BoardView, type ListItem } from "./BoardView";
import { ColorPicker } from "./ColorPicker";
import { ConfirmButton } from "./ConfirmButton";
import { addCardComment, deleteCard, updateBoard, updateCard } from "./actions";
import { DialogShell } from "./DialogShell";

export default async function BoardPage({ searchParams }: PageProps<"/boards">) {
  const { boardId } = await myBoardId();
  const sp = await searchParams;
  const cardId = typeof sp.card === "string" ? sp.card : null;

  const board = await prisma.board.findUniqueOrThrow({
    where: { id: boardId },
    include: {
      lists: {
        orderBy: { position: "asc" },
        include: {
          cards: {
            orderBy: { position: "asc" },
            include: { _count: { select: { comments: true } } },
          },
        },
      },
    },
  });
  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 864e5);
  const lists: ListItem[] = board.lists.map((l) => ({
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
      comments: c._count.comments,
      hasDescription: !!c.description,
    })),
  }));

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <span className="size-3.5 shrink-0 rounded" style={{ background: board.color }} />
            {board.title}
          </span>
        }
        subtitle={board.description ?? "Your personal board — only you can see it"}
        actions={
          <details className="relative">
            <summary className="btn cursor-pointer list-none">
              <Settings className="size-4" /> Board settings
            </summary>
            <div className="card absolute right-0 z-20 mt-2 w-80 p-4 shadow-lg">
              <form action={updateBoard} className="grid gap-3">
                <Field label="Title">
                  <input name="title" required defaultValue={board.title} className="input" />
                </Field>
                <Field label="Description">
                  <input name="description" defaultValue={board.description ?? ""} className="input" />
                </Field>
                <div>
                  <span className="label">Color</span>
                  <ColorPicker name="color" colors={BOARD_COLORS} defaultValue={board.color} />
                </div>
                <button className="btn btn-primary">Save</button>
              </form>
            </div>
          </details>
        }
      />

      <BoardView lists={lists} />

      {cardId && <CardDialog cardId={cardId} boardId={board.id} lists={board.lists} />}
    </>
  );
}

async function CardDialog({ cardId, boardId, lists }: { cardId: string; boardId: string; lists: { id: string; title: string }[] }) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { list: true, comments: { include: { author: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!card || card.list.boardId !== boardId) return null;

  return (
    <DialogShell closeHref="/boards">
      {card.color && <div className="h-2 rounded-t-xl" style={{ background: card.color }} />}
      <div className="p-6">
        <p className="mb-3 pr-10 text-xs text-dim">
          In list <span className="font-medium text-fg">{card.list.title}</span> · created {fmtRelative(card.createdAt)}
        </p>

        <form action={updateCard.bind(null, card.id)} className="grid gap-4">
          <Field label="Title">
            <input name="title" required defaultValue={card.title} className="input text-base font-medium" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="List">
              <select name="listId" defaultValue={card.listId} className="input">
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </Field>
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
