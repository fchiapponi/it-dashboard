import { Field } from "@/components/ui";
import { ASSET_STATUSES, label, toLocalInput } from "@/lib/format";

type Option = { id: string; name: string };
type AssetDefaults = {
  tag?: string;
  name?: string;
  type?: string;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  status?: string;
  departmentId?: string;
  locationId?: string | null;
  assignedTo?: string | null;
  purchaseDate?: Date | null;
  warrantyUntil?: Date | null;
  notes?: string | null;
};

export const ASSET_TYPES = ["Laptop", "Desktop", "iPad", "Chromebook", "Monitor", "Projector", "Interactive display", "Printer", "Camera", "Phone", "Network", "Furniture", "Tool", "Vehicle", "Other"];

export function AssetFields({ a = {}, departments, locations, isNew }: { a?: AssetDefaults; departments: Option[]; locations: Option[]; isNew?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Name">
        <input name="name" required defaultValue={a.name} placeholder="e.g. MacBook Air – Math dept." className="input" />
      </Field>
      <Field label="Type">
        <input name="type" required list="asset-types" defaultValue={a.type} className="input" />
        <datalist id="asset-types">
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </Field>
      {isNew && (
        <Field label="Tag (leave empty to auto-number)">
          <input name="tag" placeholder="TAS-00001" className="input uppercase" />
        </Field>
      )}
      <Field label="Serial number">
        <input name="serialNumber" defaultValue={a.serialNumber ?? ""} className="input" />
      </Field>
      <Field label="Manufacturer">
        <input name="manufacturer" defaultValue={a.manufacturer ?? ""} className="input" />
      </Field>
      <Field label="Model">
        <input name="model" defaultValue={a.model ?? ""} className="input" />
      </Field>
      <Field label="Status">
        <select name="status" defaultValue={a.status ?? "in_use"} className="input">
          {ASSET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Owning department">
        <select name="departmentId" defaultValue={a.departmentId} className="input">
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Location">
        <select name="locationId" defaultValue={a.locationId ?? ""} className="input">
          <option value="">—</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Assigned to (person)">
        <input name="assignedTo" defaultValue={a.assignedTo ?? ""} placeholder="name or email" className="input" />
      </Field>
      <Field label="Purchase date">
        <input name="purchaseDate" type="date" defaultValue={toLocalInput(a.purchaseDate).slice(0, 10)} className="input" />
      </Field>
      <Field label="Warranty until">
        <input name="warrantyUntil" type="date" defaultValue={toLocalInput(a.warrantyUntil).slice(0, 10)} className="input" />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <textarea name="notes" rows={3} defaultValue={a.notes ?? ""} className="input" />
      </Field>
    </div>
  );
}
