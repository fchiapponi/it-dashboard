import { Field } from "@/components/ui";

const PLACEHOLDERS: Record<string, string> = {
  it: "e.g. projector + 2 wireless mics, laptop for slides, livestream",
  facilities: "e.g. 120 chairs in rows, stage, 4 tables, extra cleaning",
  kitchen: "e.g. coffee break for 40 at 10:30, lunch buffet, 3 vegetarian, 1 gluten-free",
};

/** One textarea per ticket-taking department; filled ones become tickets. */
export function SupportFields({ departments }: { departments: { id: string; slug: string; name: string; color: string }[] }) {
  return (
    <div className="space-y-3">
      {departments.map((d) => (
        <Field key={d.id} label={`${d.name} support needed? (leave empty if not)`}>
          <textarea
            name={`needs_${d.slug}`}
            rows={2}
            placeholder={PLACEHOLDERS[d.slug] ?? "What do you need from this team?"}
            className="input"
            style={{ borderLeft: `3px solid ${d.color}` }}
          />
        </Field>
      ))}
    </div>
  );
}
