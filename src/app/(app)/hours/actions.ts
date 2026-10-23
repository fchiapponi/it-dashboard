"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { int, oneOf, req, str } from "@/lib/format";
import { daysBetween, DAY_HOURS, ENTRY_KINDS, expectedHours } from "@/lib/hours";
import { prisma } from "@/lib/prisma";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The days a form applies to: one day, or each (working) day of a from–until range. */
function formDays(form: FormData, workingOnly: boolean) {
  const from = req(form, "day");
  const until = str(form, "until");
  if (!DAY.test(from) || (until && !DAY.test(until))) throw new Error("Invalid date.");
  if (!until || until <= from) return [from];
  const days = daysBetween(from, until);
  if (days.length > 366) throw new Error("Pick a range of at most a year.");
  return workingOnly ? days.filter((d) => expectedHours(d) > 0) : days;
}

export async function saveDay(form: FormData) {
  const user = await requireUser();
  const kind = oneOf(str(form, "kind"), ENTRY_KINDS, "work");
  const hours = Number((str(form, "hours") ?? String(DAY_HOURS)).replace(",", "."));
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) throw new Error("Hours must be between 0 and 24.");
  const note = str(form, "note");

  await prisma.$transaction(
    formDays(form, true).map((day) =>
      prisma.timeEntry.upsert({
        where: { userId_day: { userId: user.id, day } },
        create: { userId: user.id, day, kind, hours, note },
        update: { kind, hours, note },
      }),
    ),
  );
  revalidatePath("/hours");
}

/** Puts the days back to the default 8 hours. */
export async function resetDay(form: FormData) {
  const user = await requireUser();
  await prisma.timeEntry.deleteMany({ where: { userId: user.id, day: { in: formDays(form, false) } } });
  revalidatePath("/hours");
}

export async function setVacationAllowance(form: FormData) {
  const user = await requireUser();
  const days = int(form, "vacationDays");
  if (days === null || days < 0 || days > 100) throw new Error("Enter a number of days between 0 and 100.");
  await prisma.user.update({ where: { id: user.id }, data: { vacationDays: days } });
  revalidatePath("/hours");
}
