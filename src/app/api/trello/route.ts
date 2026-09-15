import { NextResponse } from "next/server";
import { fetchTrelloLists } from "@/lib/trello";

export async function GET() {
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
