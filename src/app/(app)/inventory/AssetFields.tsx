import { Field } from "@/components/ui";
import { parseExtra } from "@/lib/assets";
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
  extra?: string | null;
};

export const ASSET_TYPES = ["Laptop", "Desktop", "iPad", "Chromebook", "Monitor", "Projector", "Interactive display", "Printer", "Camera", "Phone", "Network", "Furniture", "Tool", "Vehicle", "Other"];

/**
 * `fieldLabels` are custom field labels used by similar assets: they are shown
 * as empty rows so every iPad (say) gets the same columns, and are suggested
 * when typing a new label.
 */
export function AssetFields({
  a = {},
  departments,
  locations,
  isNew,
  fieldLabels = [],
  showAssignedTo = true,
  readFromDevice = false,
}: {
  a?: AssetDefaults;
  departments: Option[];
  locations: Option[];
  isNew?: boolean;
  fieldLabels?: string[];
  showAssignedTo?: boolean;
  /** Serial, manufacturer and model came from the printer: show them read-only. */
  readFromDevice?: boolean;
}) {
  const device = readFromDevice ? { readOnly: true, title: "Read from the printer", className: "input bg-panel-muted text-dim" } : { className: "input" };
  const extra = parseExtra(a.extra);
  const rows: [string, string][] = [...Object.entries(extra), ...fieldLabels.filter((k) => !(k in extra)).map((k): [string, string] => [k, ""])];
  for (let i = 0; i < 2; i++) rows.push(["", ""]);

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
      <Field label={readFromDevice ? "Serial number (from the printer)" : "Serial number"}>
        <input name="serialNumber" defaultValue={a.serialNumber ?? ""} {...device} />
      </Field>
      <Field label={readFromDevice ? "Manufacturer (from the printer)" : "Manufacturer"}>
        <input name="manufacturer" defaultValue={a.manufacturer ?? ""} {...device} />
      </Field>
      <Field label={readFromDevice ? "Model (from the printer)" : "Model"}>
        <input name="model" defaultValue={a.model ?? ""} {...device} />
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
      {showAssignedTo ? (
        <Field label="Assigned to (person)">
          <input name="assignedTo" defaultValue={a.assignedTo ?? ""} placeholder="name or email" className="input" />
        </Field>
      ) : (
        // Not used by this list; keep any old value rather than clearing it.
        <input type="hidden" name="assignedTo" value={a.assignedTo ?? ""} />
      )}
      <Field label="Purchase date">
        <input name="purchaseDate" type="date" defaultValue={toLocalInput(a.purchaseDate).slice(0, 10)} className="input" />
      </Field>
      <Field label="Warranty until">
        <input name="warrantyUntil" type="date" defaultValue={toLocalInput(a.warrantyUntil).slice(0, 10)} className="input" />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <textarea name="notes" rows={3} defaultValue={a.notes ?? ""} className="input" />
      </Field>
      <div className="sm:col-span-2">
        <span className="label">Additional fields (e.g. IP address, Apple ID, toner model)</span>
        <div className="space-y-2">
          {rows.map(([k, v], i) => (
            <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
              <input name="extraKey" defaultValue={k} placeholder="Field" list="extra-labels" aria-label="Field name" className="input" />
              <input name="extraValue" defaultValue={v} placeholder="Value" aria-label="Field value" className="input" />
            </div>
          ))}
        </div>
        <datalist id="extra-labels">
          {fieldLabels.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
