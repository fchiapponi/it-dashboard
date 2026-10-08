import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { fetchTrelloLists } from "@/lib/trello";

export async function GET() {
  if (!(await getUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const lists = await fetchTrelloLists();
    return NextResponse.json(lists);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Trello API error" },
      { status: 500 },
    );
  }
}
