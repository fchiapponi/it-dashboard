import type { TrelloListDTO } from "@/lib/types";

const TRELLO_API_BASE = "https://api.trello.com/1";

interface TrelloCard {
  id: string;
  name: string;
}

interface TrelloList {
  id: string;
  name: string;
  cards: TrelloCard[];
}

let cache: { at: number; data: TrelloListDTO[] } | null = null;
const CACHE_TTL_MS = 30000;

export async function fetchTrelloLists(): Promise<TrelloListDTO[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const apiKey = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  const boardId = process.env.TRELLO_BOARD_ID;
  if (!apiKey || !token || !boardId) {
    throw new Error("TRELLO_API_KEY / TRELLO_TOKEN / TRELLO_BOARD_ID not set in .env");
  }

  const url = new URL(`${TRELLO_API_BASE}/boards/${boardId}/lists`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("token", token);
  url.searchParams.set("cards", "open");
  url.searchParams.set("card_fields", "name");
  url.searchParams.set("fields", "name");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Trello API error (${res.status})`);
  }

  const lists: TrelloList[] = await res.json();
  const data = lists.map((list) => ({
    id: list.id,
    name: list.name,
    cards: list.cards.map((card) => ({ id: card.id, name: card.name })),
  }));

  cache = { at: Date.now(), data };
  return data;
}
