import { requireUser } from "@/lib/auth";
import { DEFAULT_LISTS } from "@/lib/boards";
import { prisma } from "@/lib/prisma";

/** The signed-in user and their board id, creating the board on first use. */
export async function myBoardId() {
  const user = await requireUser();
  const board = await prisma.board.upsert({
    where: { ownerId: user.id },
    update: {},
    create: { ownerId: user.id, lists: { create: DEFAULT_LISTS.map((title, position) => ({ title, position })) } },
    select: { id: true },
  });
  return { user, boardId: board.id };
}
