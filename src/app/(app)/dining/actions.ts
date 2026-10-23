"use server";

import { refresh } from "next/cache";
import { assert, requireUser } from "@/lib/auth";
import { getDepartment } from "@/lib/department";
import { getDiningData } from "@/lib/dining";
import { getI18n } from "@/i18n/server";

/** Re-reads the kitchen's sheet from Google now, instead of waiting for the next scheduled read. */
export async function refreshDining(): Promise<{ ok: boolean; message: string }> {
  await requireUser();
  assert((await getDepartment())?.slug === "kitchen");
  const data = await getDiningData(true);
  refresh();
  const { t } = await getI18n();
  return data.error ? { ok: false, message: data.error } : { ok: true, message: t("Read {n} days", { n: data.days.length }) };
}
