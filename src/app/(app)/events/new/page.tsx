import { Field, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/i18n/server";
import { createEvent } from "../actions";
import { SupportFields } from "../SupportFields";

export default async function NewEventPage() {
  await requireUser();
  const { t } = await getI18n();
  const [locations, departments] = await Promise.all([
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { takesTickets: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("New event")} subtitle={t("Support requests below are sent to each department as a ticket.")} />
      <form action={createEvent} className="card space-y-5 p-6">
        <Field label={t("Title")}>
          <input name="title" required placeholder={t("e.g. Grade 10 parents' evening")} className="input" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Starts")}>
            <input name="startsAt" type="datetime-local" required className="input" />
          </Field>
          <Field label={t("Ends")}>
            <input name="endsAt" type="datetime-local" required className="input" />
          </Field>
          <Field label={t("Location")}>
            <select name="locationId" className="input">
              <option value="">—</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Expected attendees")}>
            <input name="attendees" type="number" min={1} className="input" />
          </Field>
        </div>
        <Field label={t("Description")}>
          <textarea name="description" rows={3} className="input" />
        </Field>
        <SupportFields departments={departments} />
        <div className="flex justify-end">
          <button className="btn btn-primary">{t("Create event")}</button>
        </div>
      </form>
    </div>
  );
}
