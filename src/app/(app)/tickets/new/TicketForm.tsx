"use client";

import { Field } from "@/components/ui";
import { useI18n } from "@/i18n/client";

type Dept = { id: string; name: string; color: string; description: string | null; categories: { id: string; name: string }[] };

export function TicketForm({
  action,
  department,
  locations,
  defaults,
}: {
  action: (form: FormData) => Promise<void>;
  department: Dept;
  locations: { id: string; name: string }[];
  defaults: { assetTag?: string; title?: string; locationId?: string };
}) {
  const { t } = useI18n();

  return (
    <form action={action} className="card space-y-5 p-6">
      <input type="hidden" name="departmentId" value={department.id} />

      <Field label={t("Short summary")}>
        <input name="title" required defaultValue={defaults.title} placeholder={t("e.g. Projector in room 12 won't turn on")} className="input" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("Category")}>
          <select name="categoryId" className="input">
            <option value="">—</option>
            {department.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Location")}>
          <select name="locationId" defaultValue={defaults.locationId ?? ""} className="input">
            <option value="">—</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Priority")}>
          <select name="priority" defaultValue="normal" className="input">
            <option value="low">{t("Low")}</option>
            <option value="normal">{t("Normal")}</option>
            <option value="high">{t("High")}</option>
            <option value="urgent">{t("Urgent — class or safety affected")}</option>
          </select>
        </Field>
      </div>

      <Field label={t("Details")}>
        <textarea name="description" required rows={6} placeholder={t("What happened, room number, since when, what you already tried…")} className="input" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Asset tag (optional — printed on the QR label)")}>
          <input name="assetTag" defaultValue={defaults.assetTag} placeholder="TAS-00042" className="input max-w-48 uppercase" />
        </Field>
        <Field label={t("Needed by (optional)")}>
          <input name="dueAt" type="date" className="input max-w-48" />
        </Field>
      </div>

      <div className="flex justify-end">
        <button className="btn btn-primary">{t("Submit ticket")}</button>
      </div>
    </form>
  );
}
