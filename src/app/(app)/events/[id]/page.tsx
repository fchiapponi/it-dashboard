import Link from "next/link";
import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Badge, DeptBadge, Empty, Field, PageHeader, Section } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fmtDateTime, fmtTime, toLocalInput } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/i18n/server";
import { requestSupport, setEventStatus, updateEvent } from "../actions";
import { SupportFields } from "../SupportFields";

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const event = await prisma.event.findUnique({
    where: { id: (await params).id },
    include: {
      location: true,
      organizer: true,
      tickets: { include: { department: true, assignees: { include: { user: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!event) notFound();

  const canEdit = user.isAdmin || event.organizerId === user.id;
  const [clashes, locations, departments] = await Promise.all([
    event.locationId && event.status !== "cancelled"
      ? prisma.event.findMany({
          where: {
            id: { not: event.id },
            locationId: event.locationId,
            status: { not: "cancelled" },
            startsAt: { lt: event.endsAt },
            endsAt: { gt: event.startsAt },
          },
        })
      : [],
    canEdit ? prisma.location.findMany({ orderBy: { name: "asc" } }) : [],
    canEdit ? prisma.department.findMany({ where: { takesTickets: true }, orderBy: { name: "asc" } }) : [],
  ]);

  return (
    <>
      <PageHeader
        title={event.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge value={event.status} />
            {fmtDateTime(event.startsAt, locale)} – {fmtTime(event.endsAt, locale)}
            {event.location && ` · ${event.location.name}`}
            {` · ${t("organised by {name}", { name: event.organizer.name })}`}
          </span>
        }
        actions={
          <>
            {user.isAdmin && event.status !== "confirmed" && (
              <form action={setEventStatus.bind(null, event.id, "confirmed")}>
                <button className="btn btn-primary">{t("Confirm")}</button>
              </form>
            )}
            {canEdit && event.status !== "cancelled" && (
              <form action={setEventStatus.bind(null, event.id, "cancelled")}>
                <button className="btn btn-danger">{t("Cancel event")}</button>
              </form>
            )}
            {canEdit && event.status === "cancelled" && (
              <form action={setEventStatus.bind(null, event.id, "requested")}>
                <button className="btn">{t("Reinstate")}</button>
              </form>
            )}
          </>
        }
      />

      {clashes.length > 0 && (
        <div className="mb-6 flex items-start gap-2 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            {t("{place} is also booked at the same time for", { place: event.location?.name ?? "" })}{" "}
            {clashes.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <Link href={`/events/${c.id}`} className="font-medium underline">
                  {c.title}
                </Link>{" "}
                ({fmtTime(c.startsAt, locale)}–{fmtTime(c.endsAt, locale)})
              </span>
            ))}
            .
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {event.description && (
            <Section>
              <div className="p-5 text-sm whitespace-pre-wrap">{event.description}</div>
            </Section>
          )}
          <Section title={t("Support requests")}>
            {event.tickets.length === 0 ? (
              <Empty>{t("No support requested.")}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {event.tickets.map((ticket) => (
                  <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <DeptBadge dept={ticket.department} />
                      <Link href={`/tickets/${ticket.number}`} className="hover:underline">
                        #{ticket.number}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-dim">
                      {ticket.assignees.map((a) => a.user.name).join(", ") || t("Unassigned")} <Badge value={ticket.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {canEdit && (
              <form action={requestSupport.bind(null, event.id)} className="space-y-3 border-t border-line p-4">
                <SupportFields departments={departments} />
                <button className="btn">{t("Send requests")}</button>
              </form>
            )}
          </Section>
        </div>

        {canEdit && (
          <Section title={t("Edit event")} className="self-start">
            <form action={updateEvent.bind(null, event.id)} className="space-y-3 p-4">
              <Field label={t("Title")}>
                <input name="title" required defaultValue={event.title} className="input" />
              </Field>
              <Field label={t("Starts")}>
                <input name="startsAt" type="datetime-local" required defaultValue={toLocalInput(event.startsAt)} className="input" />
              </Field>
              <Field label={t("Ends")}>
                <input name="endsAt" type="datetime-local" required defaultValue={toLocalInput(event.endsAt)} className="input" />
              </Field>
              <Field label={t("Location")}>
                <select name="locationId" defaultValue={event.locationId ?? ""} className="input">
                  <option value="">—</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Expected attendees")}>
                <input name="attendees" type="number" min={1} defaultValue={event.attendees ?? ""} className="input" />
              </Field>
              <Field label={t("Description")}>
                <textarea name="description" rows={3} defaultValue={event.description ?? ""} className="input" />
              </Field>
              <button className="btn btn-primary w-full">{t("Save")}</button>
              <p className="text-xs text-dim">{t("Changing date or place doesn't update existing tickets — add a reply on them.")}</p>
            </form>
          </Section>
        )}
      </div>
    </>
  );
}
