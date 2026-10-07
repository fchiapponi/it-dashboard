"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assert } from "@/lib/auth";
import { boardForAction, cardForAction, listForAction } from "@/lib/boardAccess";
import { BOARD_COLORS, CARD_COLORS } from "@/lib/boards";
import { fromLocalInput, oneOf, req, str } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** URL of a board: /boards for a personal board, /boards/<department slug> for a shared one. */
async function boardPath(board: { departmentId: string | null }) {
  if (!board.departmentId) return "/boards";
  const d = await prisma.department.findUniqueOrThrow({ where: { id: board.departmentId } });
  return `/boards/${d.slug}`;
}

/** Bumps the board's updatedAt and refreshes every board page. */
async function touch(boardId: string) {
  await prisma.board.update({ where: { id: boardId }, data: { updatedAt: new Date() } });
  revalidatePath("/boards", "layout");
}

// ------------------------------------------------------------------ board

export async function updateBoard(boardId: string, form: FormData) {
  const { board } = await boardForAction(boardId);
  await prisma.board.update({
    where: { id: board.id },
    data: {
      title: req(form, "title"),
      description: str(form, "description"),
      color: oneOf(str(form, "color"), BOARD_COLORS, BOARD_COLORS[0]!),
    },
  });
  revalidatePath("/boards", "layout");
}

// ------------------------------------------------------------------ lists

export async function createList(boardId: string, form: FormData) {
  const { board } = await boardForAction(boardId);
  const last = await prisma.boardList.findFirst({ where: { boardId: board.id }, orderBy: { position: "desc" } });
  await prisma.boardList.create({ data: { boardId: board.id, title: req(form, "title"), position: (last?.position ?? -1) + 1 } });
  await touch(board.id);
}

export async function renameList(listId: string, form: FormData) {
  const { list } = await listForAction(listId);
  await prisma.boardList.update({ where: { id: list.id }, data: { title: req(form, "title") } });
  await touch(list.boardId);
}

export async function deleteList(listId: string) {
  const { list } = await listForAction(listId);
  await prisma.boardList.delete({ where: { id: list.id } });
  await touch(list.boardId);
}

/** Saves the left-to-right order of a board's lists. */
export async function reorderLists(boardId: string, listIds: string[]) {
  const { board } = await boardForAction(boardId);
  await prisma.$transaction(
    listIds.map((id, position) => prisma.boardList.updateMany({ where: { id, boardId: board.id }, data: { position } })),
  );
  await touch(board.id);
}

// ------------------------------------------------------------------ cards

export async function createCard(listId: string, form: FormData) {
  const { user, list } = await listForAction(listId);
  const last = await prisma.card.findFirst({ where: { listId }, orderBy: { position: "desc" } });
  await prisma.card.create({
    data: { listId, title: req(form, "title"), position: (last?.position ?? -1) + 1, createdById: user.id },
  });
  await touch(list.boardId);
}

/**
 * Puts a card into `listId` and saves that list's new top-to-bottom order.
 * `orderedIds` is the destination list's card ids after the move, including the moved card.
 */
export async function moveCard(cardId: string, listId: string, orderedIds: string[]) {
  const { card } = await cardForAction(cardId);
  const { list } = await listForAction(listId);
  assert(card.list.boardId === list.boardId, "Cards can only move between lists of the same board.");

  await prisma.$transaction([
    prisma.card.update({ where: { id: card.id }, data: { listId } }),
    ...orderedIds.map((id, position) => prisma.card.updateMany({ where: { id, listId }, data: { position } })),
  ]);
  await touch(list.boardId);
}

export async function updateCard(cardId: string, form: FormData) {
  const { card } = await cardForAction(cardId);
  const board = card.list.board;

  // Moving through the dialog's list picker drops the card at the bottom of the new list.
  let listId = card.listId;
  let position = card.position;
  const newListId = str(form, "listId");
  if (newListId && newListId !== card.listId) {
    const { list: target } = await listForAction(newListId);
    assert(target.boardId === board.id, "Cards can only move between lists of the same board.");
    const last = await prisma.card.findFirst({ where: { listId: target.id }, orderBy: { position: "desc" } });
    listId = target.id;
    position = (last?.position ?? -1) + 1;
  }

  // Only shared boards have assignees, and only people who can open the board.
  let assigneeId: string | null = null;
  const pickedId = board.departmentId ? str(form, "assigneeId") : null;
  if (pickedId) {
    const picked = await prisma.user.findUnique({ where: { id: pickedId }, include: { memberships: true } });
    assert(
      picked && (picked.role === "admin" || picked.memberships.some((m) => m.departmentId === board.departmentId)),
      "That person isn't in this department.",
    );
    assigneeId = picked.id;
  }

  const color = str(form, "color");
  await prisma.card.update({
    where: { id: cardId },
    data: {
      title: req(form, "title"),
      description: str(form, "description"),
      color: color && CARD_COLORS.includes(color) ? color : null,
      assigneeId,
      dueAt: fromLocalInput(str(form, "dueAt")),
      done: form.get("done") === "on",
      listId,
      position,
    },
  });
  await touch(board.id);
}

export async function deleteCard(cardId: string) {
  const { card } = await cardForAction(cardId);
  await prisma.card.delete({ where: { id: card.id } });
  await touch(card.list.boardId);
  redirect(await boardPath(card.list.board));
}

export async function addCardComment(cardId: string, form: FormData) {
  const { user, card } = await cardForAction(cardId);
  await prisma.cardComment.create({ data: { cardId, authorId: user.id, body: req(form, "body") } });
  await touch(card.list.boardId);
}
