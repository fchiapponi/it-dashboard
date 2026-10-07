"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assert } from "@/lib/auth";
import { BOARD_COLORS, CARD_COLORS } from "@/lib/boards";
import { myBoardId } from "@/lib/myBoard";
import { fromLocalInput, oneOf, req, str } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const BOARD_PATH = "/boards";

/** Loads a list and checks it's on the signed-in user's board. */
async function myList(listId: string) {
  const { user, boardId } = await myBoardId();
  const list = await prisma.boardList.findUnique({ where: { id: listId } });
  assert(list?.boardId === boardId, "That list isn't on your board.");
  return { user, list };
}

/** Loads a card and checks it's on the signed-in user's board. */
async function myCard(cardId: string) {
  const { user, boardId } = await myBoardId();
  const card = await prisma.card.findUnique({ where: { id: cardId }, include: { list: true } });
  assert(card?.list.boardId === boardId, "That card isn't on your board.");
  return { user, card };
}

/** Bumps the board's updatedAt and refreshes the board page. */
async function touch(boardId: string) {
  await prisma.board.update({ where: { id: boardId }, data: { updatedAt: new Date() } });
  revalidatePath(BOARD_PATH);
}

// ------------------------------------------------------------------ board

export async function updateBoard(form: FormData) {
  const { boardId } = await myBoardId();
  await prisma.board.update({
    where: { id: boardId },
    data: {
      title: req(form, "title"),
      description: str(form, "description"),
      color: oneOf(str(form, "color"), BOARD_COLORS, BOARD_COLORS[0]!),
    },
  });
  revalidatePath(BOARD_PATH);
}

// ------------------------------------------------------------------ lists

export async function createList(form: FormData) {
  const { boardId } = await myBoardId();
  const last = await prisma.boardList.findFirst({ where: { boardId }, orderBy: { position: "desc" } });
  await prisma.boardList.create({ data: { boardId, title: req(form, "title"), position: (last?.position ?? -1) + 1 } });
  await touch(boardId);
}

export async function renameList(listId: string, form: FormData) {
  const { list } = await myList(listId);
  await prisma.boardList.update({ where: { id: list.id }, data: { title: req(form, "title") } });
  await touch(list.boardId);
}

export async function deleteList(listId: string) {
  const { list } = await myList(listId);
  await prisma.boardList.delete({ where: { id: list.id } });
  await touch(list.boardId);
}

/** Saves the left-to-right order of the board's lists. */
export async function reorderLists(listIds: string[]) {
  const { boardId } = await myBoardId();
  await prisma.$transaction(
    listIds.map((id, position) => prisma.boardList.updateMany({ where: { id, boardId }, data: { position } })),
  );
  await touch(boardId);
}

// ------------------------------------------------------------------ cards

export async function createCard(listId: string, form: FormData) {
  const { user, list } = await myList(listId);
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
  const { card } = await myCard(cardId);
  const { list } = await myList(listId);

  await prisma.$transaction([
    prisma.card.update({ where: { id: card.id }, data: { listId } }),
    ...orderedIds.map((id, position) => prisma.card.updateMany({ where: { id, listId }, data: { position } })),
  ]);
  await touch(list.boardId);
}

export async function updateCard(cardId: string, form: FormData) {
  const { card } = await myCard(cardId);

  // Moving through the dialog's list picker drops the card at the bottom of the new list.
  let listId = card.listId;
  let position = card.position;
  const newListId = str(form, "listId");
  if (newListId && newListId !== card.listId) {
    const { list: target } = await myList(newListId);
    const last = await prisma.card.findFirst({ where: { listId: target.id }, orderBy: { position: "desc" } });
    listId = target.id;
    position = (last?.position ?? -1) + 1;
  }

  const color = str(form, "color");
  await prisma.card.update({
    where: { id: cardId },
    data: {
      title: req(form, "title"),
      description: str(form, "description"),
      color: color && CARD_COLORS.includes(color) ? color : null,
      dueAt: fromLocalInput(str(form, "dueAt")),
      done: form.get("done") === "on",
      listId,
      position,
    },
  });
  await touch(card.list.boardId);
}

export async function deleteCard(cardId: string) {
  const { card } = await myCard(cardId);
  await prisma.card.delete({ where: { id: card.id } });
  await touch(card.list.boardId);
  redirect(BOARD_PATH);
}

export async function addCardComment(cardId: string, form: FormData) {
  const { user, card } = await myCard(cardId);
  await prisma.cardComment.create({ data: { cardId, authorId: user.id, body: req(form, "body") } });
  await touch(card.list.boardId);
}
