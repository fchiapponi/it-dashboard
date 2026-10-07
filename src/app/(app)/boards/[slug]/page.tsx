import { openDepartmentBoard } from "@/lib/boardAccess";
import { BoardScreen } from "../BoardScreen";

export default async function DepartmentBoardPage({ params, searchParams }: PageProps<"/boards/[slug]">) {
  const { board, department } = await openDepartmentBoard((await params).slug);
  const sp = await searchParams;
  return (
    <BoardScreen board={board} department={department} cardId={typeof sp.card === "string" ? sp.card : null} />
  );
}
