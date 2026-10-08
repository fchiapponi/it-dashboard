import "server-only";
import { notFound } from "next/navigation";
import { assert, requireUser, type CurrentUser } from "@/lib/auth";
import { DEFAULT_LISTS } from "@/lib/boards";
import { prisma } from "@/lib/prisma";

type BoardOwner = { ownerId: string | null; departmentId: string | null };

/** Personal boards are private; department boards are shared with everyone. */
export function canUseBoard(user: CurrentUser, board: BoardOwner) {
  return board.ownerId === user.id || !!board.departmentId;
}

/** Departments with a shared board, for the board tabs. */
export function boardDepartments() {
  return prisma.department.findMany({ orderBy: { name: "asc" } });
}

const starterLists = { create: DEFAULT_LISTS.map((title, position) => ({ title, position })) };

/** The signed-in user's personal board, created on first use. */
export async function openMyBoard() {
  const user = await requireUser();
  const board = await prisma.board.upsert({
    where: { ownerId: user.id },
    update: {},
    create: { ownerId: user.id, lists: starterLists },
  });
  return { user, board };
}

/** A department's shared board by department slug, created on first use. */
export async function openDepartmentBoard(slug: string) {
  const user = await requireUser();
  const department = await prisma.department.findUnique({ where: { slug } });
  if (!department) notFound();
  const board = await prisma.board.upsert({
    where: { departmentId: department.id },
    update: {},
    create: { departmentId: department.id, title: `${department.name} board`, color: department.color, lists: starterLists },
  });
  return { user, board, department };
}

/** Loads a board for a server action and checks the user may change it. */
export async function boardForAction(boardId: string) {
  const user = await requireUser();
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  assert(board && canUseBoard(user, board), "You can't change that board.");
  return { user, board };
}

/** Loads a list (with its board) for a server action and checks access. */
export async function listForAction(listId: string) {
  const user = await requireUser();
  const list = await prisma.boardList.findUnique({ where: { id: listId }, include: { board: true } });
  assert(list && canUseBoard(user, list.board), "You can't change that list.");
  return { user, list };
}

/** Loads a card (with its list and board) for a server action and checks access. */
export async function cardForAction(cardId: string) {
  const user = await requireUser();
  const card = await prisma.card.findUnique({ where: { id: cardId }, include: { list: { include: { board: true } } } });
  assert(card && canUseBoard(user, card.list.board), "You can't change that card.");
  return { user, card };
}
