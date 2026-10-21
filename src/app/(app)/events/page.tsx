import Link from "next/link";
import { CalendarDays, MapPin, Plus, Users } from "lucide-react";
import { Badge, Empty, FilterTabs, PageHeader, Section } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fmtTime, startOfToday } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { INTL } from "@/i18n";
import { getI18n } from "@/i18n/server";

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  await requireUser();
  const past = (await searchParams).when === "past";
  const today = startOfToday();
  const { t, locale } = await getI18n();
  const dayFmt = new Intl.DateTimeFormat(INTL[locale], { timeZone: "Europe/Zurich", weekday: "long", day: "numeric", month: "long" });

  const events = await prisma.event.findMany({
    where: past ? { endsAt: { lt: today } } : { endsAt: { gte: today } },
    include: { location: true, organizer: true, tickets: { select: { status: true } } },
    orderBy: { startsAt: past ? "desc" : "asc" },
    take: 100,
  });

  // Group by day for an agenda-style list.
  const days = new Map<string, typeof events>();
  for (const e of events) {
    const key = dayFmt.format(e.startsAt);
    days.set(key, [...(days.get(key) ?? []), e]);
  }

  return (
    <>
      <PageHeader
        title={t("Events")}
        subtitle={t("School events and the IT, Facilities, Electrician and Kitchen support they need")}
        actions={
          <Link href="/events/new" className="btn btn-primary">
            <Plus className="size-4" /> {t("New event")}
          </Link>
        }
      />
      <FilterTabs
        active={past ? "past" : "upcoming"}
        items={[
          { key: "upcoming", label: t("Upcoming"), href: "/events" },
          { key: "past", label: t("Past"), href: "/events?when=past" },
        ]}
      />
      {events.length === 0 ? (
        <Section>
          <Empty>{t("No events.")}</Empty>
        </Section>
      ) : (
        <div className="space-y-6">
          {[...days].map(([day, list]) => (
            <div key={day}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-dim">
                <CalendarDays className="size-4" /> {day}
              </h2>
              <div className="card divide-y divide-line">
                {list.map((e) => {
                  const openTickets = e.tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length;
                  return (
                    <Link key={e.id} href={`/events/${e.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-panel-muted">
                      <span className="w-28 shrink-0 text-dim tabular-nums">
                        {fmtTime(e.startsAt, locale)} – {fmtTime(e.endsAt, locale)}
                      </span>
                      <span className="min-w-0 flex-1 font-medium">{e.title}</span>
                      {e.location && (
                        <span className="flex items-center gap-1 text-xs text-dim">
                          <MapPin className="size-3.5" /> {e.location.name}
                        </span>
                      )}
                      {e.attendees && (
                        <span className="flex items-center gap-1 text-xs text-dim">
                          <Users className="size-3.5" /> {e.attendees}
                        </span>
                      )}
                      {e.tickets.length > 0 && (
                        <Badge tone={openTickets ? "amber" : "green"}>
                          {openTickets
                            ? t(openTickets > 1 ? "{n} open requests" : "{n} open request", { n: openTickets })
                            : t("Support ready")}
                        </Badge>
                      )}
                      <Badge value={e.status} />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
