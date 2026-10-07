"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assert, isAgentOf, requireUser } from "@/lib/auth";
import { fmtDate, fromLocalInput, int, label, oneOf, req, str, TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canViewTicket, createTicketRecord } from "@/lib/tickets";

export async function createTicket(form: FormData) {
  const user = await requireUser();
  const department = await prisma.department.findUniqueOrThrow({ where: { id: req(form, "departmentId") } });
  assert(department.takesTickets, "This department doesn't accept tickets.");

  const categoryId = str(form, "categoryId");
  if (categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    assert(cat?.departmentId === department.id, "Category doesn't belong to that department.");
  }
  const assetTag = str(form, "assetTag");
  const asset = assetTag ? await prisma.asset.findUnique({ where: { tag: assetTag.toUpperCase() } }) : null;
  if (assetTag && !asset) throw new Error(`No asset with tag ${assetTag}.`);

  const ticket = await prisma.$transaction((tx) =>
    createTicketRecord(
      {
        title: req(form, "title"),
        description: req(form, "description"),
        priority: oneOf(str(form, "priority"), TICKET_PRIORITIES, "normal"),
        departmentId: department.id,
        categoryId,
        locationId: str(form, "locationId"),
        assetId: asset?.id ?? null,
        requesterId: user.id,
        dueAt: fromLocalInput(str(form, "dueAt")),
      },
      tx,
    ),
  );
  redirect(`/tickets/${ticket.number}`);
}

async function loadForAgent(ticketId: string) {
  const user = await requireUser();
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { assignees: true } });
  assert(isAgentOf(user, ticket.departmentId));
  return { user, ticket };
}

/** Agent-side changes: status, priority, assignees, due date, category, department. Logs each change. */
export async function updateTicket(ticketId: string, form: FormData) {
  const { user, ticket } = await loadForAgent(ticketId);

  const status = oneOf(str(form, "status"), TICKET_STATUSES, ticket.status as (typeof TICKET_STATUSES)[number]);
  const priority = oneOf(str(form, "priority"), TICKET_PRIORITIES, ticket.priority as (typeof TICKET_PRIORITIES)[number]);
  const assigneeIds = [...new Set(form.getAll("assigneeIds").filter((v): v is string => typeof v === "string" && v !== ""))];
  const currentIds = ticket.assignees.map((a) => a.userId);
  const added = assigneeIds.filter((id) => !currentIds.includes(id));
  const removed = currentIds.filter((id) => !assigneeIds.includes(id));
  const dueAt = fromLocalInput(str(form, "dueAt"));
  const departmentId = str(form, "departmentId") ?? ticket.departmentId;
  // Moving to another department drops the category, which belongs to the old one.
  const categoryId = departmentId === ticket.departmentId ? str(form, "categoryId") : null;

  const events: string[] = [];
  if (status !== ticket.status) events.push(`changed status to ${label(status)}`);
  if (priority !== ticket.priority) events.push(`changed priority to ${label(priority)}`);
  if (added.length || removed.length) {
    const names = new Map(
      (await prisma.user.findMany({ where: { id: { in: [...added, ...removed] } } })).map((u) => [u.id, u.name]),
    );
    const list = (ids: string[]) => ids.map((id) => names.get(id) ?? "someone").join(", ");
    if (added.length) events.push(`assigned to ${list(added)}`);
    if (removed.length) events.push(`unassigned ${list(removed)}`);
  }
  if (dueAt?.getTime() !== ticket.dueAt?.getTime()) events.push(dueAt ? `set the due date to ${fmtDate(dueAt)}` : "removed the due date");
  if (departmentId !== ticket.departmentId) {
    const d = await prisma.department.findUniqueOrThrow({ where: { id: departmentId } });
    events.push(`moved to ${d.name}`);
  }
  if (!events.length && categoryId === ticket.categoryId) return;

  const done = status === "resolved" || status === "closed";
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status,
      priority,
      assignees: {
        deleteMany: { userId: { in: removed } },
        create: added.map((userId) => ({ userId })),
      },
      dueAt,
      departmentId,
      categoryId,
      resolvedAt: done ? (ticket.resolvedAt ?? new Date()) : null,
    },
  });
  if (events.length) {
    await prisma.ticketActivity.createMany({
      data: events.map((body) => ({ ticketId: ticket.id, authorId: user.id, kind: "event", body })),
    });
  }
  revalidatePath(`/tickets/${ticket.number}`);
}

export async function takeTicket(ticketId: string) {
  const { user, ticket } = await loadForAgent(ticketId);
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      // Joins whoever is already assigned instead of replacing them.
      assignees: ticket.assignees.some((a) => a.userId === user.id) ? undefined : { create: { userId: user.id } },
      status: ticket.status === "open" ? "in_progress" : ticket.status,
    },
  });
  await prisma.ticketActivity.create({
    data: { ticketId: ticket.id, authorId: user.id, kind: "event", body: "took this ticket" },
  });
  revalidatePath(`/tickets/${ticket.number}`);
}

export async function addComment(ticketId: string, form: FormData) {
  const user = await requireUser();
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assert(canViewTicket(user, ticket));

  const agent = isAgentOf(user, ticket.departmentId);
  const internal = agent && form.get("internal") === "on";
  await prisma.ticketActivity.create({
    data: { ticketId, authorId: user.id, kind: internal ? "note" : "comment", body: req(form, "body") },
  });
  // Replies count as an update, so the ticket list sorts recently answered tickets first.
  await prisma.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });

  // A requester replying to a resolved or waiting ticket puts it back in the queue.
  if (!agent && ["resolved", "waiting"].includes(ticket.status)) {
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: "open", resolvedAt: null } });
    await prisma.ticketActivity.create({
      data: { ticketId, authorId: user.id, kind: "event", body: "reopened by reply" },
    });
  }
  revalidatePath(`/tickets/${ticket.number}`);
}

/** Requester confirms their issue is fixed. */
export async function closeOwnTicket(ticketId: string) {
  const user = await requireUser();
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  assert(ticket.requesterId === user.id);
  await prisma.ticket.update({ where: { id: ticketId }, data: { status: "closed", resolvedAt: ticket.resolvedAt ?? new Date() } });
  await prisma.ticketActivity.create({ data: { ticketId, authorId: user.id, kind: "event", body: "closed this ticket" } });
  revalidatePath(`/tickets/${ticket.number}`);
}

/** Uses consumables on a ticket: lowers stock and links the movement to the ticket. */
export async function consumeSupply(ticketId: string, form: FormData) {
  const { user, ticket } = await loadForAgent(ticketId);
  const supply = await prisma.supply.findUniqueOrThrow({ where: { id: req(form, "supplyId") } });
  assert(isAgentOf(user, supply.departmentId));
  const qty = Math.max(1, int(form, "quantity") ?? 1);

  await prisma.$transaction([
    prisma.supply.update({ where: { id: supply.id }, data: { quantity: { decrement: qty } } }),
    prisma.stockMovement.create({
      data: { supplyId: supply.id, delta: -qty, reason: `Ticket #${ticket.number}`, actorId: user.id, ticketId },
    }),
    prisma.ticketActivity.create({
      data: { ticketId, authorId: user.id, kind: "event", body: `used ${qty} ${supply.unit} of ${supply.name}` },
    }),
  ]);
  revalidatePath(`/tickets/${ticket.number}`);
}
