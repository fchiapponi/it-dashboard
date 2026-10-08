import "server-only";
import type { Prisma } from "@/generated/prisma";
import { isAgentOf, type CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Standby tickets are parked but not done, so they still count as active.
export const ACTIVE_STATUSES = ["open", "in_progress", "waiting", "standby"];

/** Tickets a user may see: their own requests plus every ticket of departments they belong to. */
export function visibleTickets(user: CurrentUser): Prisma.TicketWhereInput {
  if (user.isAdmin) return {};
  return { OR: [{ requesterId: user.id }, { departmentId: { in: user.departmentIds } }] };
}

export function canViewTicket(user: CurrentUser, t: { requesterId: string; departmentId: string }) {
  return t.requesterId === user.id || isAgentOf(user, t.departmentId);
}

type NewTicket = Omit<Prisma.TicketUncheckedCreateInput, "number" | "id">;

/** Creates a ticket with the next sequential number. */
export async function createTicketRecord(data: NewTicket, tx: Prisma.TransactionClient = prisma) {
  const last = await tx.ticket.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const ticket = await tx.ticket.create({ data: { ...data, number: (last?.number ?? 1000) + 1 } });
  await tx.ticketActivity.create({
    data: { ticketId: ticket.id, authorId: data.requesterId, kind: "event", body: "created this ticket" },
  });
  return ticket;
}

/** Departments a user may manage inventory for. */
export function managedDepartments(user: CurrentUser) {
  return prisma.department.findMany({
    where: user.isAdmin ? {} : { id: { in: user.departmentIds } },
    orderBy: { name: "asc" },
  });
}

export function lowStockCount(departmentIds?: string[]) {
  return prisma.supply.count({
    where: {
      quantity: { lte: prisma.supply.fields.minQuantity },
      ...(departmentIds ? { departmentId: { in: departmentIds } } : {}),
    },
  });
}
