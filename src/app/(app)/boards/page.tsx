import { openMyBoard } from "@/lib/boardAccess";
import { BoardScreen } from "./BoardScreen";

export default async function MyBoardPage({ searchParams }: PageProps<"/boards">) {
  const { board } = await openMyBoard();
  const sp = await searchParams;
  return <BoardScreen board={board} cardId={typeof sp.card === "string" ? sp.card : null} />;
}
