import { Field } from "@/components/ui";
import type { Message } from "@/i18n";
import { getI18n } from "@/i18n/server";

const PLACEHOLDERS: Record<string, Message> = {
  it: "e.g. projector + 2 wireless mics, laptop for slides, livestream",
  facilities: "e.g. 120 chairs in rows, stage, 4 tables, extra cleaning",
  electrician: "e.g. 3 extra sockets on stage, stage lighting, power for a food truck outside",
  kitchen: "e.g. coffee break for 40 at 10:30, lunch buffet, 3 vegetarian, 1 gluten-free",
};

/** One textarea per ticket-taking department; filled ones become tickets. */
export async function SupportFields({ departments }: { departments: { id: string; slug: string; name: string; color: string }[] }) {
  const { t } = await getI18n();
  return (
    <div className="space-y-3">
      {departments.map((d) => (
        <Field key={d.id} label={t("{dept} support needed? (leave empty if not)", { dept: d.name })}>
          <textarea
            name={`needs_${d.slug}`}
            rows={2}
            placeholder={t(PLACEHOLDERS[d.slug] ?? "What do you need from this team?")}
            className="input"
            style={{ borderLeft: `3px solid ${d.color}` }}
          />
        </Field>
      ))}
    </div>
  );
}
