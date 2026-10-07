"use client";

import { startTransition, useOptimistic, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { AlignLeft, CalendarDays, Check, MessageSquare, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createCard, createList, deleteList, moveCard, renameList, reorderLists } from "./actions";

export type CardItem = {
  id: string;
  title: string;
  color: string | null;
  done: boolean;
  due: { label: string; state: "overdue" | "today" | "later" } | null;
  comments: number;
  hasDescription: boolean;
};
export type ListItem = { id: string; title: string; cards: CardItem[] };

type Move = { kind: "card"; cardId: string; toListId: string; index: number } | { kind: "lists"; ids: string[] };
type Drag = { kind: "card"; id: string } | { kind: "list"; id: string };

function applyMove(lists: ListItem[], move: Move): ListItem[] {
  if (move.kind === "lists") return move.ids.map((id) => lists.find((l) => l.id === id)!).filter(Boolean);
  const card = lists.flatMap((l) => l.cards).find((c) => c.id === move.cardId);
  if (!card) return lists;
  return lists.map((l) => {
    const cards = l.cards.filter((c) => c.id !== move.cardId);
    if (l.id === move.toListId) cards.splice(move.index, 0, card);
    return { ...l, cards };
  });
}

/** Whether the pointer is in the first half of the element along an axis. */
function inFirstHalf(e: DragEvent<HTMLElement>, axis: "x" | "y") {
  const r = e.currentTarget.getBoundingClientRect();
  return axis === "y" ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2;
}

export function BoardView({ lists: serverLists }: { lists: ListItem[] }) {
  const router = useRouter();
  const [lists, optimisticMove] = useOptimistic(serverLists, applyMove);
  const drag = useRef<Drag | null>(null);
  const [cardTarget, setCardTarget] = useState<{ listId: string; index: number } | null>(null);
  const [listTarget, setListTarget] = useState<number | null>(null);
  // A list only becomes draggable when pressed outside its inputs and cards, so text selection keeps working.
  const [armedList, setArmedList] = useState<string | null>(null);

  const startDrag = (e: DragEvent, d: Drag) => {
    e.stopPropagation();
    drag.current = d;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", d.id); // Firefox only starts a drag when data is set
  };

  const endDrag = () => {
    drag.current = null;
    setCardTarget(null);
    setListTarget(null);
  };

  const overCard = (e: DragEvent<HTMLElement>, listId: string, index: number) => {
    if (drag.current?.kind !== "card") return;
    e.preventDefault();
    e.stopPropagation();
    const i = inFirstHalf(e, "y") ? index : index + 1;
    if (cardTarget?.listId !== listId || cardTarget.index !== i) setCardTarget({ listId, index: i });
  };

  const overListEnd = (e: DragEvent<HTMLElement>, list: ListItem) => {
    if (drag.current?.kind !== "card") return;
    e.preventDefault();
    if (cardTarget?.listId !== list.id || cardTarget.index !== list.cards.length) setCardTarget({ listId: list.id, index: list.cards.length });
  };

  const overColumn = (e: DragEvent<HTMLElement>, index: number) => {
    if (drag.current?.kind !== "list") return;
    e.preventDefault();
    const i = inFirstHalf(e, "x") ? index : index + 1;
    if (listTarget !== i) setListTarget(i);
  };

  const drop = (e: DragEvent) => {
    e.preventDefault();
    const d = drag.current;
    endDrag();
    if (!d) return;

    if (d.kind === "card" && cardTarget) {
      const from = lists.find((l) => l.cards.some((c) => c.id === d.id));
      const to = lists.find((l) => l.id === cardTarget.listId);
      if (!from || !to) return;
      const fromIndex = from.cards.findIndex((c) => c.id === d.id);
      // The target index counts the dragged card itself when it stays in the same list.
      const index = from.id === to.id && fromIndex < cardTarget.index ? cardTarget.index - 1 : cardTarget.index;
      if (from.id === to.id && index === fromIndex) return;
      const ids = to.cards.map((c) => c.id).filter((id) => id !== d.id);
      ids.splice(index, 0, d.id);
      startTransition(async () => {
        optimisticMove({ kind: "card", cardId: d.id, toListId: to.id, index });
        await moveCard(d.id, to.id, ids);
      });
    }

    if (d.kind === "list" && listTarget !== null) {
      const ids = lists.map((l) => l.id);
      const fromIndex = ids.indexOf(d.id);
      const index = fromIndex < listTarget ? listTarget - 1 : listTarget;
      if (index === fromIndex) return;
      ids.splice(fromIndex, 1);
      ids.splice(index, 0, d.id);
      startTransition(async () => {
        optimisticMove({ kind: "lists", ids });
        await reorderLists(ids);
      });
    }
  };

  const openCard = (id: string) => router.push(`/boards?card=${id}`, { scroll: false });

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8" onDrop={drop} onDragOver={(e) => drag.current && e.preventDefault()}>
      <div className="flex items-start gap-3">
        {lists.map((list, li) => (
          <div key={list.id} className="relative flex shrink-0" onDragOver={(e) => overColumn(e, li)}>
            {listTarget === li && <DropLine vertical />}
            <section
              className="flex w-72 flex-col rounded-xl border border-line bg-panel-muted"
              draggable={armedList === list.id}
              onPointerDown={(e) =>
                setArmedList((e.target as HTMLElement).closest("input, textarea, button, form, [data-card]") ? null : list.id)
              }
              onDragStart={(e) => startDrag(e, { kind: "list", id: list.id })}
              onDragEnd={endDrag}
            >
              <ListHeader list={list} />
              <div className="min-h-2 px-2" onDragOver={(e) => overListEnd(e, list)}>
                {list.cards.map((card, ci) => (
                  <div key={card.id} className="pb-2" onDragOver={(e) => overCard(e, list.id, ci)}>
                    {cardTarget?.listId === list.id && cardTarget.index === ci && <DropLine />}
                    <CardFace
                      card={card}
                      onOpen={() => openCard(card.id)}
                      onDragStart={(e) => startDrag(e, { kind: "card", id: card.id })}
                      onDragEnd={endDrag}
                    />
                  </div>
                ))}
                {cardTarget?.listId === list.id && cardTarget.index === list.cards.length && (
                  <div className="pb-2">
                    <DropLine />
                  </div>
                )}
              </div>
              <AddCard listId={list.id} />
            </section>
            {listTarget === li + 1 && li === lists.length - 1 && <DropLine vertical />}
          </div>
        ))}
        <AddList />
      </div>
    </div>
  );
}

function DropLine({ vertical }: { vertical?: boolean }) {
  return vertical ? (
    <div className="absolute inset-y-0 -left-2 w-1 rounded-full bg-accent" />
  ) : (
    <div className="mb-2 h-1 rounded-full bg-accent" />
  );
}

function CardFace({
  card,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  card: CardItem;
  onOpen: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="cursor-pointer overflow-hidden rounded-lg border border-line bg-panel text-sm shadow-xs transition hover:border-accent/40"
    >
      {card.color && <div className="h-1.5" style={{ background: card.color }} />}
      <div className="px-3 py-2">
        <div className={cn("break-words", card.done && "text-dim line-through")}>{card.title}</div>
        {(card.due || card.comments > 0 || card.hasDescription || card.done) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-dim">
            {card.due && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
                  card.done
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : card.due.state === "overdue"
                      ? "bg-red-500/15 text-red-700 dark:text-red-300"
                      : card.due.state === "today" && "bg-amber-500/15 text-amber-800 dark:text-amber-300",
                )}
              >
                <CalendarDays className="size-3" />
                {card.due.label}
              </span>
            )}
            {card.done && !card.due && (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                <Check className="size-3" /> Done
              </span>
            )}
            {card.hasDescription && <AlignLeft className="size-3.5" aria-label="Has a description" />}
            {card.comments > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="size-3.5" />
                {card.comments}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ListHeader({ list }: { list: ListItem }) {
  const save = (input: HTMLInputElement) => {
    const title = input.value.trim();
    if (!title) {
      input.value = list.title;
      return;
    }
    if (title === list.title) return;
    const form = new FormData();
    form.set("title", title);
    startTransition(() => renameList(list.id, form));
  };

  return (
    <div className="flex items-center gap-1 px-2 pt-2 pb-1">
      <input
        key={list.title}
        defaultValue={list.title}
        aria-label="List title"
        className="min-w-0 flex-1 cursor-pointer rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold outline-none focus:cursor-text focus:border-accent focus:bg-panel"
        onBlur={(e) => save(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = list.title;
            e.currentTarget.blur();
          }
        }}
      />
      <span className="text-xs text-dim tabular-nums">{list.cards.length}</span>
      <button
        className="btn border-0 bg-transparent px-1.5 text-dim"
        title="Delete list"
        onClick={() => {
          const msg = list.cards.length
            ? `Delete the list "${list.title}" and its ${list.cards.length} card(s)?`
            : `Delete the list "${list.title}"?`;
          if (confirm(msg)) startTransition(() => deleteList(list.id));
        }}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function AddCard({ listId }: { listId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="m-2 mt-0 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-dim hover:bg-panel hover:text-fg" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add a card
      </button>
    );
  }
  return (
    <form action={createCard.bind(null, listId)} className="space-y-2 p-2 pt-0">
      <textarea
        name="title"
        required
        autoFocus
        rows={2}
        placeholder="Card title"
        className="input resize-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <div className="flex gap-2">
        <button className="btn btn-primary">Add card</button>
        <button type="button" className="btn border-0 bg-transparent px-2" title="Cancel" onClick={() => setOpen(false)}>
          <X className="size-4" />
        </button>
      </div>
    </form>
  );
}

function AddList() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        className="flex w-72 shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-dim hover:bg-panel hover:text-fg"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" /> Add a list
      </button>
    );
  }
  return (
    <form action={createList} className="w-72 shrink-0 space-y-2 rounded-xl border border-line bg-panel-muted p-2">
      <input
        name="title"
        required
        autoFocus
        placeholder="List title"
        className="input"
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
      <div className="flex gap-2">
        <button className="btn btn-primary">Add list</button>
        <button type="button" className="btn border-0 bg-transparent px-2" title="Cancel" onClick={() => setOpen(false)}>
          <X className="size-4" />
        </button>
      </div>
    </form>
  );
}
