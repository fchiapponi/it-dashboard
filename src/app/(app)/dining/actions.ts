"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getDiningData } from "@/lib/dining";

/** Re-reads the kitchen's sheet from Google now, instead of waiting for the next scheduled read. */
export async function refreshDining(): Promise<{ ok: boolean; message: string }> {
  await requireUser();
  const data = await getDiningData(true);
  refresh();
  return data.error ? { ok: false, message: data.error } : { ok: true, message: `Read ${data.days.length} days` };
}
