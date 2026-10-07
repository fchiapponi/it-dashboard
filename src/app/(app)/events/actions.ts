"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma";
import { assert, requireUser, type CurrentUser } from "@/lib/auth";
import { EVENT_STATUSES, fmtDateTime, fromLocalInput, int, oneOf, req, str } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { createTicketRecord } from "@/lib/tickets";

/** One ticket per department whose "support needed" box was filled in. */
async function createSupportTickets(
  tx: Prisma.TransactionClient,
  user: CurrentUser,
  event: { id: string; title: string; startsAt: Date; endsAt: Date; locationId: string | null; attendees: number | null },
  form: FormData,
) {
  const departments = await tx.department.findMany({ where: { takesTickets: true } });
  const location = event.locationId ? await tx.location.findUnique({ where: { id: event.locationId } }) : null;
  for (const d of departments) {
    const details = str(form, `needs_${d.slug}`);
    if (!details) continue;
    await createTicketRecord(
      {
        title: `Event: ${event.title}`,
        description: [
          details,
          "",
          `When: ${fmtDateTime(event.startsAt)} – ${fmtDateTime(event.endsAt)}`,
          `Where: ${location?.name ?? "—"}`,
          event.attendees ? `Attendees: ${event.attendees}` : null,
        ]
          .filter((l) => l !== null)
          .join("\n"),
        departmentId: d.id,
        locationId: event.locationId,
        requesterId: user.id,
        eventId: event.id,
        priority: "normal",
        dueAt: event.startsAt,
      },
      tx,
    );
  }
}

function eventFields(form: FormData) {
  const startsAt = fromLocalInput(req(form, "startsAt"));
  const endsAt = fromLocalInput(req(form, "endsAt"));
  assert(startsAt && endsAt, "Invalid date.");
  assert(endsAt > startsAt, "The event must end after it starts.");
  return {
    title: req(form, "title"),
    description: str(form, "description"),
    startsAt,
    endsAt,
    locationId: str(form, "locationId"),
    attendees: int(form, "attendees"),
  };
}

export async function createEvent(form: FormData) {
  const user = await requireUser();
  const data = eventFields(form);
  const event = await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({ data: { ...data, organizerId: user.id } });
    await createSupportTickets(tx, user, event, form);
    return event;
  });
  redirect(`/events/${event.id}`);
}

const canEdit = (user: CurrentUser, e: { organizerId: string }) => user.isAdmin || e.organizerId === user.id;

export async function updateEvent(id: string, form: FormData) {
  const user = await requireUser();
  const event = await prisma.event.findUniqueOrThrow({ where: { id } });
  assert(canEdit(user, event));
  await prisma.event.update({ where: { id }, data: eventFields(form) });
  revalidatePath(`/events/${id}`);
}

/** Admins confirm; organizers (and admins) can cancel. */
export async function setEventStatus(id: string, status: string) {
  const user = await requireUser();
  const event = await prisma.event.findUniqueOrThrow({ where: { id } });
  const next = oneOf(status, EVENT_STATUSES, "requested");
  assert(user.isAdmin || (event.organizerId === user.id && next !== "confirmed"));
  await prisma.event.update({ where: { id }, data: { status: next } });
  revalidatePath(`/events/${id}`);
}

export async function requestSupport(id: string, form: FormData) {
  const user = await requireUser();
  const event = await prisma.event.findUniqueOrThrow({ where: { id } });
  assert(canEdit(user, event));
  await prisma.$transaction((tx) => createSupportTickets(tx, user, event, form));
  revalidatePath(`/events/${id}`);
}
