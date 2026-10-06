"use client";

import { useState } from "react";
import { Field } from "@/components/ui";
import { cn } from "@/lib/utils";

type Dept = { id: string; name: string; color: string; description: string | null; categories: { id: string; name: string }[] };

export function TicketForm({
  action,
  departments,
  locations,
  defaults,
}: {
  action: (form: FormData) => Promise<void>;
  departments: Dept[];
  locations: { id: string; name: string }[];
  defaults: { departmentId?: string; assetTag?: string; title?: string; locationId?: string };
}) {
  const [deptId, setDeptId] = useState(defaults.departmentId ?? departments[0]?.id);
  const dept = departments.find((d) => d.id === deptId);

  return (
    <form action={action} className="card space-y-5 p-6">
      <div>
        <span className="label">Who should handle this?</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {departments.map((d) => (
            <label
              key={d.id}
              className={cn(
                "cursor-pointer rounded-lg border p-3 transition",
                d.id === deptId ? "border-accent ring-2 ring-accent/20" : "border-line hover:bg-panel-muted",
              )}
            >
              <input type="radio" name="departmentId" value={d.id} checked={d.id === deptId} onChange={() => setDeptId(d.id)} className="sr-only" />
              <div className="flex items-center gap-2 font-medium">
                <span className="size-2.5 rounded-full" style={{ background: d.color }} />
                {d.name}
              </div>
              {d.description && <div className="mt-1 text-xs text-dim">{d.description}</div>}
            </label>
          ))}
        </div>
      </div>

      <Field label="Short summary">
        <input name="title" required defaultValue={defaults.title} placeholder="e.g. Projector in room 12 won't turn on" className="input" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Category">
          <select name="categoryId" className="input" key={deptId}>
            <option value="">—</option>
            {dept?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location">
          <select name="locationId" defaultValue={defaults.locationId ?? ""} className="input">
            <option value="">—</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select name="priority" defaultValue="normal" className="input">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent — class or safety affected</option>
          </select>
        </Field>
      </div>

      <Field label="Details">
        <textarea name="description" required rows={6} placeholder="What happened, room number, since when, what you already tried…" className="input" />
      </Field>

      <Field label="Asset tag (optional — printed on the QR label)">
        <input name="assetTag" defaultValue={defaults.assetTag} placeholder="TAS-00042" className="input max-w-48 uppercase" />
      </Field>

      <div className="flex justify-end">
        <button className="btn btn-primary">Submit ticket</button>
      </div>
    </form>
  );
}
