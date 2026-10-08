"use server";

import { revalidatePath } from "next/cache";
import { assert, isReception, requireUser } from "@/lib/auth";
import { fromLocalInput, req, str } from "@/lib/format";
import { prisma } from "@/lib/prisma";

function visitorFields(form: FormData) {
  return {
    name: req(form, "name"),
    company: str(form, "company"),
    email: str(form, "email"),
    phone: str(form, "phone"),
    purpose: str(form, "purpose"),
    hostId: str(form, "hostId"),
    hostName: str(form, "hostName"),
  };
}

/** Staff announce a visitor they're expecting; reception sees them on the day. */
export async function preRegisterVisitor(form: FormData) {
  const user = await requireUser();
  const expectedAt = fromLocalInput(req(form, "expectedAt"));
  assert(expectedAt, "Invalid date.");
  await prisma.visitor.create({
    data: { ...visitorFields(form), hostId: str(form, "hostId") ?? user.id, expectedAt, createdById: user.id },
  });
  revalidatePath("/visitors");
}

/** Reception: someone walked in without being announced. */
export async function walkInVisitor(form: FormData) {
  const user = await requireUser();
  assert(isReception(user));
  await prisma.visitor.create({
    data: { ...visitorFields(form), badgeNumber: str(form, "badgeNumber"), checkedInAt: new Date(), createdById: user.id },
  });
  revalidatePath("/visitors");
}

export async function checkInVisitor(id: string, form: FormData) {
  const user = await requireUser();
  assert(isReception(user));
  await prisma.visitor.update({ where: { id }, data: { checkedInAt: new Date(), badgeNumber: str(form, "badgeNumber") } });
  revalidatePath("/visitors");
}

export async function checkOutVisitor(id: string) {
  const user = await requireUser();
  assert(isReception(user));
  await prisma.visitor.update({ where: { id }, data: { checkedOutAt: new Date() } });
  revalidatePath("/visitors");
}

/** Removes a pre-registration that hasn't arrived yet. */
export async function cancelVisitor(id: string) {
  const user = await requireUser();
  const v = await prisma.visitor.findUniqueOrThrow({ where: { id } });
  assert(!v.checkedInAt, "This visitor has already checked in.");
  assert(isReception(user) || v.createdById === user.id || v.hostId === user.id);
  await prisma.visitor.delete({ where: { id } });
  revalidatePath("/visitors");
}
