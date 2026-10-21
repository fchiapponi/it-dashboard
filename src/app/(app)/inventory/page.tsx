import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, Columns3, Plus, Printer, Trash2 } from "lucide-react";
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
  parseExtra,
  parseReadings,
  readAssetFilters,
  readingLabel,
  savedColumns,
} from "@/lib/assets";
import { isAgent, requireUser } from "@/lib/auth";
import { ASSET_STATUSES, fmtDate, fmtDateTime, label } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { lowStockCount, managedDepartments } from "@/lib/tickets";
import { ConfirmButton } from "../boards/ConfirmButton";
import { bulkUpdateAssets, deleteAssets, refreshAllPrinters } from "./actions";
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
  const { t, locale } = await getI18n();
  const filters = readAssetFilters(sp);

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
  const [byType, made] = await Promise.all([
    prisma.asset.groupBy({ by: ["type", "status"], where: { departmentId: dept.id }, _count: true, orderBy: { type: "asc" } }),
    // Lists added with "New list" show up before their first item.
    prisma.assetList.findMany({ where: { departmentId: dept.id }, select: { type: true } }),
  ]);
  const types = [...new Set([...byType.map((g) => g.type), ...made.map((l) => l.type)])].sort((a, b) => a.localeCompare(b));
  const lists = types.map((type) => ({
    type,
    count: byType.filter((g) => g.type === type && g.status !== "retired").reduce((n, g) => n + g._count, 0),
  }));
  const type = lists.find((l) => l.type === filters.type)?.type ?? lists[0]?.type ?? "";
  const f = { ...filters, dept: dept.slug, type };

  const [assets, locations, low, saved, byBuilding] = await Promise.all([
    type ? prisma.asset.findMany({ where: assetWhere(f), include: { location: true }, orderBy: ASSET_SORTS[f.sort], take: LIMIT }) : [],
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    lowStockCount(user.isAdmin ? undefined : user.departmentIds),
    type ? savedColumns(dept.id, type) : null,
    // How many items of this list each building has, with the other filters applied.
    type ? prisma.asset.groupBy({ by: ["locationId"], where: assetWhere({ ...f, building: "" }), _count: true }) : [],
  ]);
  const inBuilding = (id: string | null) => byBuilding.find((g) => g.locationId === id)?._count ?? 0;
  // Each list has its own columns, chosen on /inventory/columns.
  const columns = saved ?? defaultColumns(type, assets);
  const columnsHref = `/inventory/columns?dept=${dept.slug}&type=${encodeURIComponent(type)}`;
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
        title={t("{dept} inventory", { dept: dept.name })}
        subtitle={t("Every tagged item, where it is and who has it")}
        actions={
          <>
            {isPrinter(f) && <PrinterButton action={refreshAllPrinters}>{t("Refresh all printers")}</PrinterButton>}
            <Link href={addHref} className="btn btn-primary">
              <Plus className="size-4" /> {type ? t("Add {type}", { type }) : t("Add item")}
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
            href={`/inventory${filterQuery({ dept: dept.slug, type: l.type, building: f.building })}`}
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
          <Plus className="inline size-3.5" /> {t("New list")}
        </Link>
      </div>

      {!type ? (
        <div className="card">
          <Empty>
            {t("{dept} has no inventory yet.", { dept: dept.name })}{" "}
            <Link href={`/inventory/new?dept=${dept.slug}&newList=1`} className="link">
              {t("Start a list")}
            </Link>{" "}
            {t("(e.g. iPads, Laptops, Printers).")}
          </Empty>
        </div>
      ) : (
        <>
          <form className="mb-4 flex flex-wrap gap-2" action="/inventory">
            <input type="hidden" name="dept" value={dept.slug} />
            <input type="hidden" name="type" value={type} />
            {f.sort !== "tag" && <input type="hidden" name="sort" value={f.sort} />}
            <input name="q" defaultValue={f.q} placeholder={t("Search {type}: tag, name, serial, room, any field…", { type })} className="input max-w-sm" />
            <select name="status" defaultValue={f.status} className="input w-auto">
              <option value="">{t("Active (not retired)")}</option>
              {ASSET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {label(s, locale)}
                </option>
              ))}
              <option value="all">{t("All, including retired")}</option>
            </select>
            <select name="building" defaultValue={f.building} aria-label={t("Building")} className="input w-auto">
              <option value="">{t("All buildings")}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({inBuilding(l.id)})
                </option>
              ))}
              <option value="none">
                {t("No building")} ({inBuilding(null)})
              </option>
            </select>
            <button className="btn">{t("Filter")}</button>
          </form>

          {/* Tick rows, then print their QR labels or change them all at once. */}
          <form action="/inventory/labels">
            <Section
              title={t(assets.length === 1 ? "{n} item" : "{n} items", { n: `${assets.length}${assets.length === LIMIT ? "+" : ""}` })}
              actions={
                <div className="flex gap-2">
                  <Link href={columnsHref} className="btn">
                    <Columns3 className="size-4" /> {t("Columns")}
                  </Link>
                  <button className="btn">
                    <Printer className="size-4" /> {t("Print labels")}
                  </button>
                  <ConfirmButton
                    formAction={deleteAssets}
                    message={t("Delete the selected items permanently, with their history? To keep the history, set their status to Retired instead.")}
                    className="btn btn-danger"
                    title={t("Delete selected")}
                  >
                    <Trash2 className="size-4" />
                  </ConfirmButton>
                </div>
              }
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel-muted px-4 py-3 text-sm">
                <span className="text-dim">{t("Change selected:")}</span>
                <select name="bulkStatus" defaultValue="" className="input w-auto" aria-label={t("New status")}>
                  <option value="">{t("Status…")}</option>
                  {ASSET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {label(s, locale)}
                    </option>
                  ))}
                </select>
                <select name="bulkLocation" defaultValue="" className="input w-auto" aria-label={t("New location")}>
                  <option value="">{t("Location…")}</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <select name="bulkDept" defaultValue="" className="input w-auto" aria-label={t("New department")}>
                  <option value="">{t("Move to department…")}</option>
                  {departments.filter((d) => d.id !== dept.id).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {columns.includes("assignedTo") && (
                  <>
                    <input name="bulkAssigned" placeholder={t("Assign to…")} className="input w-40" aria-label={t("Assign to")} />
                    <label className="flex items-center gap-1.5 text-dim">
                      <input type="checkbox" name="bulkUnassign" /> {t("Unassign")}
                    </label>
                  </>
                )}
                {settable.length > 0 && (
                  <>
                    <select name="bulkField" defaultValue="" className="input w-auto" aria-label={t("Field to set")}>
                      <option value="">{t("Set field…")}</option>
                      {settable.map((c) => (
                        <option key={c} value={c}>
                          {columnLabel(c, locale)}
                        </option>
                      ))}
                    </select>
                    <input name="bulkValue" placeholder={t("to (empty clears)")} className="input w-40" aria-label={t("Value")} />
                  </>
                )}
                <button formAction={bulkUpdateAssets} className="btn">
                  {t("Apply")}
                </button>
              </div>

              {assets.length === 0 ? (
                <Empty>
                  {f.q ? (
                    t("Nothing matches.")
                  ) : (
                    <>
                      {t("No {type} here.", { type })}{" "}
                      <Link href={addHref} className="link">
                        {t("Add one")}
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
                        {sortHeader("tag", t("Tag"))}
                        {columns.map((c) => (c in ASSET_SORTS ? sortHeader(c, columnLabel(c, locale)) : <th key={c}>{columnLabel(c, locale)}</th>))}
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((a) => {
                        const extra = parseExtra(a.extra);
                        return (
                          <tr key={a.id} className="hover:bg-panel-muted">
                            <td>
                              <input type="checkbox" name="tag" value={a.tag} aria-label={t("Select {tag}", { tag: a.tag })} />
                            </td>
                            <td className="font-mono text-xs whitespace-nowrap">
                              <Link href={`/inventory/${a.tag}`} className="link">
                                {a.tag}
                              </Link>
                            </td>
                            {columns.map((c) => (
                              <td key={c} className={c === "name" ? undefined : "text-dim"}>
                                {cell(a, c, extra, columns, locale)}
                              </td>
                            ))}
                            <td>
                              <Link
                                href={`/inventory/labels?tag=${encodeURIComponent(a.tag)}&print=1`}
                                className="text-dim hover:text-fg"
                                title={t("Print label")}
                                aria-label={t("Print label")}
                              >
                                <Printer className="size-4" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </Section>
          </form>
        </>
      )}
    </>
  );
}

function cell(a: Asset & { location: Location | null }, key: string, extra: Record<string, string>, columns: string[], locale: Locale) {
  const custom = extraLabel(key);
  if (custom !== null) return extra[custom] ?? "—";
  const readings = parseReadings(a.readings);
  if (key === INK_COLUMN) return <InkLevels supplies={readings?.supplies ?? []} compact />;
  const reading = readingLabel(key);
  if (reading === "Last read") return readings ? fmtDateTime(new Date(readings.readAt), locale) : "—";
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
      return a[key] ? fmtDate(a[key], locale) : "—";
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
