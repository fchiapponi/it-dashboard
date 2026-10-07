import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, Columns3, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { Badge, Empty, FilterTabs, PageHeader, Section, TableWrap } from "@/components/ui";
import type { Asset, Location } from "@/generated/prisma";
import {
  ASSET_SORTS,
  assetWhere,
  columnLabel,
  defaultColumns,
  extraLabel,
  filterQuery,
  INK_COLUMN,
  isDeviceField,
  isPrinter,
  isReadFromDevice,
  parseExtra,
  parseReadings,
  readAssetFilters,
  readingLabel,
  savedColumns,
} from "@/lib/assets";
import { isAgent, requireUser } from "@/lib/auth";
import { ASSET_STATUSES, fmtDate, fmtDateTime, label, toLocalInput } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { lowStockCount, managedDepartments } from "@/lib/tickets";
import { ConfirmButton } from "../boards/ConfirmButton";
import { bulkUpdateAssets, deleteAssets, refreshAllPrinters, saveTable } from "./actions";
import { InkLevels } from "./InkLevels";
import { PrinterButton } from "./PrinterButton";
import { SelectAll } from "./SelectAll";
import { InventoryTabs } from "./Tabs";

const LIMIT = 2000;
const SETTABLE = new Set(["name", "manufacturer", "model", "serialNumber", "assignedTo", "notes"]);

export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  const user = await requireUser();
  if (!isAgent(user)) notFound();
  const sp = await searchParams;
  const filters = readAssetFilters(sp);
  const editing = sp.edit === "1";

  // Each department has its own inventory, and inside it one list per type
  // (Printers, iPads, …), each with its own columns.
  const departments = await managedDepartments(user);
  // Default: the user's own department, else the first one with any items.
  const stocked = new Set((await prisma.asset.groupBy({ by: ["departmentId"] })).map((g) => g.departmentId));
  const dept =
    departments.find((d) => d.slug === filters.dept) ??
    departments.find((d) => user.departmentIds.includes(d.id)) ??
    departments.find((d) => stocked.has(d.id)) ??
    departments[0];
  if (!dept) notFound();
  const byType = await prisma.asset.groupBy({ by: ["type", "status"], where: { departmentId: dept.id }, _count: true, orderBy: { type: "asc" } });
  const lists = [...new Set(byType.map((t) => t.type))].map((type) => ({
    type,
    count: byType.filter((t) => t.type === type && t.status !== "retired").reduce((n, t) => n + t._count, 0),
  }));
  const type = lists.find((l) => l.type === filters.type)?.type ?? lists[0]?.type ?? "";
  const f = { ...filters, dept: dept.slug, type };

  const [assets, locations, low, saved] = await Promise.all([
    type ? prisma.asset.findMany({ where: assetWhere(f), include: { location: true }, orderBy: ASSET_SORTS[f.sort], take: LIMIT }) : [],
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    lowStockCount(user.isAdmin ? undefined : user.departmentIds),
    type ? savedColumns(dept.id, type) : null,
  ]);
  // Each list has its own columns, chosen on /inventory/columns.
  const columns = saved ?? defaultColumns(type, assets);
  const columnsHref = `/inventory/columns?dept=${dept.slug}&type=${encodeURIComponent(type)}`;
  const listHref = `/inventory${filterQuery(f)}`;
  const editHref = `${listHref}${listHref.includes("?") ? "&" : "?"}edit=1`;
  // Columns that "Set field…" can fill: plain text fields and custom fields.
  // On printer lists, serial/model/manufacturer come from the printers.
  const settable = columns.filter((c) => (SETTABLE.has(c) && !(isPrinter(f) && isDeviceField(c))) || extraLabel(c) !== null);
  const addHref = `/inventory/new?dept=${dept.slug}${type ? `&type=${encodeURIComponent(type)}` : ""}`;

  const sortHeader = (key: string, text: string) => (
    <th key={key}>
      <Link href={`/inventory${filterQuery({ ...f, sort: key })}`} className="inline-flex items-center gap-1 hover:text-fg">
        {text}
        {f.sort === key && <ArrowDown className="size-3" />}
      </Link>
    </th>
  );

  return (
    <>
      <PageHeader
        title={`${dept.name} inventory`}
        subtitle="Every tagged item, where it is and who has it"
        actions={
          <>
            {isPrinter(f) && <PrinterButton action={refreshAllPrinters}>Refresh all printers</PrinterButton>}
            <Link href={addHref} className="btn btn-primary">
              <Plus className="size-4" /> Add {type || "item"}
            </Link>
          </>
        }
      />
      <InventoryTabs active="assets" lowStock={low} />

      {departments.length > 1 && (
        <FilterTabs
          active={dept.slug}
          items={departments.map((d) => ({ key: d.slug, label: d.name, href: `/inventory?dept=${d.slug}` }))}
        />
      )}

      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-line pb-3">
        {lists.map((l) => (
          <Link
            key={l.type}
            href={`/inventory${filterQuery({ dept: dept.slug, type: l.type })}`}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm",
              l.type === type ? "bg-accent font-medium text-white shadow-sm" : "text-dim hover:bg-panel hover:text-fg",
            )}
          >
            {l.type}
            <span className={cn("ml-1.5 text-xs", l.type === type ? "text-white/80" : "text-dim")}>{l.count}</span>
          </Link>
        ))}
        <Link href={`/inventory/new?dept=${dept.slug}&newList=1`} className="rounded-lg px-3 py-1.5 text-sm text-dim hover:text-fg">
          <Plus className="inline size-3.5" /> New list
        </Link>
      </div>

      {!type ? (
        <div className="card">
          <Empty>
            {dept.name} has no inventory yet.{" "}
            <Link href={`/inventory/new?dept=${dept.slug}&newList=1`} className="link">
              Start a list
            </Link>{" "}
            (e.g. iPads, Laptops, Printers).
          </Empty>
        </div>
      ) : (
        <>
          <form className="mb-4 flex flex-wrap gap-2" action="/inventory">
            <input type="hidden" name="dept" value={dept.slug} />
            <input type="hidden" name="type" value={type} />
            {f.sort !== "tag" && <input type="hidden" name="sort" value={f.sort} />}
            <input name="q" defaultValue={f.q} placeholder={`Search ${type}: tag, name, serial, room, any field…`} className="input max-w-sm" />
            <select name="status" defaultValue={f.status} className="input w-auto">
              <option value="">Active (not retired)</option>
              {ASSET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
              <option value="all">All, including retired</option>
            </select>
            <button className="btn">Filter</button>
          </form>

          {editing ? (
            // Edit mode: every editable cell is an input; "Save all" writes only what changed.
            <form action={saveTable}>
              <input type="hidden" name="back" value={listHref} />
              <Section
                title={`Editing ${assets.length} item${assets.length === 1 ? "" : "s"}`}
                actions={
                  <div className="flex gap-2">
                    <Link href={listHref} className="btn">
                      Cancel
                    </Link>
                    <button className="btn btn-primary">Save all</button>
                  </div>
                }
              >
                <TableWrap>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tag</th>
                        {columns.map((c) => (
                          <th key={c}>{columnLabel(c)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((a) => {
                        const extra = parseExtra(a.extra);
                        return (
                          <tr key={a.id}>
                            <td className="font-mono text-xs whitespace-nowrap">{a.tag}</td>
                            {columns.map((c) => (
                              <td key={c} className="px-1.5 py-1">
                                {editCell(a, c, extra, columns, locations)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableWrap>
              </Section>
            </form>
          ) : (
          /* Tick rows, then print their QR labels or change them all at once. */
          <form action="/inventory/labels">
            <Section
              title={`${assets.length}${assets.length === LIMIT ? "+" : ""} item${assets.length === 1 ? "" : "s"}`}
              actions={
                <div className="flex gap-2">
                  <Link href={editHref} className="btn">
                    <Pencil className="size-4" /> Edit table
                  </Link>
                  <Link href={columnsHref} className="btn">
                    <Columns3 className="size-4" /> Columns
                  </Link>
                  <button className="btn">
                    <Printer className="size-4" /> Print labels
                  </button>
                  <ConfirmButton
                    formAction={deleteAssets}
                    message="Delete the selected items permanently, with their history? To keep the history, set their status to Retired instead."
                    className="btn btn-danger"
                    title="Delete selected"
                  >
                    <Trash2 className="size-4" />
                  </ConfirmButton>
                </div>
              }
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel-muted px-4 py-3 text-sm">
                <span className="text-dim">Change selected:</span>
                <select name="bulkStatus" defaultValue="" className="input w-auto" aria-label="New status">
                  <option value="">Status…</option>
                  {ASSET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
                <select name="bulkLocation" defaultValue="" className="input w-auto" aria-label="New location">
                  <option value="">Location…</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <select name="bulkDept" defaultValue="" className="input w-auto" aria-label="New department">
                  <option value="">Move to department…</option>
                  {departments.filter((d) => d.id !== dept.id).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {columns.includes("assignedTo") && (
                  <>
                    <input name="bulkAssigned" placeholder="Assign to…" className="input w-40" aria-label="Assign to" />
                    <label className="flex items-center gap-1.5 text-dim">
                      <input type="checkbox" name="bulkUnassign" /> Unassign
                    </label>
                  </>
                )}
                {settable.length > 0 && (
                  <>
                    <select name="bulkField" defaultValue="" className="input w-auto" aria-label="Field to set">
                      <option value="">Set field…</option>
                      {settable.map((c) => (
                        <option key={c} value={c}>
                          {columnLabel(c)}
                        </option>
                      ))}
                    </select>
                    <input name="bulkValue" placeholder="to (empty clears)" className="input w-40" aria-label="Value" />
                  </>
                )}
                <button formAction={bulkUpdateAssets} className="btn">
                  Apply
                </button>
              </div>

              {assets.length === 0 ? (
                <Empty>
                  {f.q ? (
                    "Nothing matches."
                  ) : (
                    <>
                      No {type} here.{" "}
                      <Link href={addHref} className="link">
                        Add one
                      </Link>
                      .
                    </>
                  )}
                </Empty>
              ) : (
                <TableWrap>
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="w-8">
                          <SelectAll />
                        </th>
                        {sortHeader("tag", "Tag")}
                        {columns.map((c) => (c in ASSET_SORTS ? sortHeader(c, columnLabel(c)) : <th key={c}>{columnLabel(c)}</th>))}
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((a) => {
                        const extra = parseExtra(a.extra);
                        return (
                          <tr key={a.id} className="hover:bg-panel-muted">
                            <td>
                              <input type="checkbox" name="tag" value={a.tag} aria-label={`Select ${a.tag}`} />
                            </td>
                            <td className="font-mono text-xs whitespace-nowrap">
                              <Link href={`/inventory/${a.tag}`} className="link">
                                {a.tag}
                              </Link>
                            </td>
                            {columns.map((c) => (
                              <td key={c} className={c === "name" ? undefined : "text-dim"}>
                                {cell(a, c, extra, columns)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </Section>
          </form>
          )}
        </>
      )}
    </>
  );
}

function cell(a: Asset & { location: Location | null }, key: string, extra: Record<string, string>, columns: string[]) {
  const custom = extraLabel(key);
  if (custom !== null) return extra[custom] ?? "—";
  const readings = parseReadings(a.readings);
  if (key === INK_COLUMN) return <InkLevels supplies={readings?.supplies ?? []} compact />;
  const reading = readingLabel(key);
  if (reading === "Last read") return readings ? fmtDateTime(new Date(readings.readAt)) : "—";
  if (reading !== null) return readings?.fields[reading] ?? "—";
  switch (key) {
    case "name": {
      // Model and serial under the name, unless they have columns of their own.
      const sub = [!columns.includes("model") && a.model, !columns.includes("serialNumber") && a.serialNumber && `S/N ${a.serialNumber}`].filter(Boolean);
      return (
        <>
          {a.name}
          {sub.length > 0 && <div className="text-xs text-dim">{sub.join(" · ")}</div>}
        </>
      );
    }
    case "status":
      return <Badge value={a.status} />;
    case "location":
      return a.location?.name ?? "—";
    case "purchaseDate":
    case "warrantyUntil":
    case "updatedAt":
      return a[key] ? fmtDate(a[key]) : "—";
    case "assignedTo":
    case "manufacturer":
    case "model":
    case "serialNumber":
    case "notes":
      return a[key] ?? "—";
    default:
      return "—";
  }
}

/** An input for one cell in edit mode; read-only columns (printer readings, …) stay as text. */
function editCell(
  a: Asset & { location: Location | null },
  key: string,
  extra: Record<string, string>,
  columns: string[],
  locations: Location[],
) {
  const name = `${a.id}|${key}`;
  const cls = "input min-w-32 px-2 py-1";
  const custom = extraLabel(key);
  if (isDeviceField(key) && isReadFromDevice(a)) return <span className="px-2 text-dim" title="Read from the printer">{cell(a, key, extra, columns)}</span>;
  if (custom !== null) return <input name={name} defaultValue={extra[custom] ?? ""} aria-label={`${a.tag} ${custom}`} className={cls} />;
  switch (key) {
    case "name":
    case "manufacturer":
    case "model":
    case "serialNumber":
    case "assignedTo":
    case "notes":
      return <input name={name} defaultValue={a[key] ?? ""} required={key === "name"} aria-label={`${a.tag} ${columnLabel(key)}`} className={cls} />;
    case "purchaseDate":
    case "warrantyUntil":
      return <input name={name} type="date" defaultValue={toLocalInput(a[key]).slice(0, 10)} aria-label={`${a.tag} ${columnLabel(key)}`} className={cls} />;
    case "status":
      return (
        <select name={name} defaultValue={a.status} aria-label={`${a.tag} status`} className={cls}>
          {ASSET_STATUSES.map((st) => (
            <option key={st} value={st}>
              {label(st)}
            </option>
          ))}
        </select>
      );
    case "location":
      return (
        <select name={name} defaultValue={a.locationId ?? ""} aria-label={`${a.tag} location`} className={cls}>
          <option value="">—</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      );
    default:
      return <span className="px-2 text-dim">{cell(a, key, extra, columns)}</span>;
  }
}
