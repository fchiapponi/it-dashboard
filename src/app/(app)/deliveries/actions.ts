"use server";

import { revalidatePath } from "next/cache";
import { assert, isReception, requireUser } from "@/lib/auth";
import { int, str } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export async function logDelivery(form: FormData) {
  const user = await requireUser();
  assert(isReception(user));
  const recipientId = str(form, "recipientId");
  const recipient = recipientId ? await prisma.user.findUnique({ where: { id: recipientId } }) : null;
  const recipientName = recipient?.name ?? str(form, "recipientName");
  if (!recipientName) throw new Error("Pick a recipient or type their name.");

  await prisma.delivery.create({
    data: {
      carrier: str(form, "carrier"),
      trackingNumber: str(form, "trackingNumber"),
      recipientId: recipient?.id ?? null,
      recipientName,
      description: str(form, "description"),
      packages: Math.max(1, int(form, "packages") ?? 1),
      storageSpot: str(form, "storageSpot"),
      notes: str(form, "notes"),
      receivedById: user.id,
    },
  });
  revalidatePath("/deliveries");
}

export async function markCollected(id: string, form: FormData) {
  const user = await requireUser();
  assert(isReception(user));
  const d = await prisma.delivery.findUniqueOrThrow({ where: { id } });
  await prisma.delivery.update({
    where: { id },
    data: { status: "collected", collectedAt: new Date(), collectedBy: str(form, "collectedBy") ?? d.recipientName },
  });
  revalidatePath("/deliveries");
}

export async function markReturned(id: string) {
  const user = await requireUser();
  assert(isReception(user));
  await prisma.delivery.update({ where: { id }, data: { status: "returned", collectedAt: new Date() } });
  revalidatePath("/deliveries");
}

export async function undoCollected(id: string) {
  const user = await requireUser();
  assert(isReception(user));
  await prisma.delivery.update({ where: { id }, data: { status: "received", collectedAt: null, collectedBy: null } });
  revalidatePath("/deliveries");
}
