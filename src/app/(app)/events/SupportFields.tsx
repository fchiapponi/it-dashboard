import { Field } from "@/components/ui";

/** One textarea per ticket-taking department; filled ones become tickets. */
export function SupportFields({ departments }: { departments: { id: string; slug: string; name: string; color: string }[] }) {
  return (
    <div className="space-y-3">
      {departments.map((d) => (
        <Field key={d.id} label={`${d.name} support needed? (leave empty if not)`}>
          <textarea
            name={`needs_${d.slug}`}
            rows={2}
            placeholder={d.slug === "it" ? "e.g. projector + 2 wireless mics, laptop for slides, livestream" : "e.g. 120 chairs in rows, stage, 4 tables, extra cleaning"}
            className="input"
            style={{ borderLeft: `3px solid ${d.color}` }}
          />
        </Field>
      ))}
    </div>
  );
}
