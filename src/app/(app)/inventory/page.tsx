import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, Plus, Printer, Trash2 } from "lucide-react";
import { Badge, DeptBadge, Empty, FilterTabs, PageHeader, Section, TableWrap } from "@/components/ui";
import { ASSET_SORTS, assetWhere, extraKeys, filterQuery, parseExtra, readAssetFilters } from "@/lib/assets";
import { isAgent, requireUser } from "@/lib/auth";
import { ASSET_STATUSES, label } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { lowStockCount, managedDepartments } from "@/lib/tickets";
import { ConfirmButton } from "../boards/ConfirmButton";
import { bulkUpdateAssets, deleteAssets } from "./actions";
import { SelectAll } from "./SelectAll";
import { InventoryTabs } from "./Tabs";

const LIMIT = 2000;

export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  const user = await requireUser();
  if (!isAgent(user)) notFound();
  const f = readAssetFilters(await searchParams);

  const [assets, typeCounts, departments, myDepartments, locations, low] = await Promise.all([
    prisma.asset.findMany({ where: assetWhere(f), include: { department: true, location: true }, orderBy: ASSET_SORTS[f.sort], take: LIMIT }),
    prisma.asset.groupBy({ by: ["type"], where: assetWhere({ ...f, type: "", q: "" }), _count: true, orderBy: { type: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    managedDepartments(user),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    lowStockCount(user.isAdmin ? undefined : user.departmentIds),
  ]);
  const total = typeCounts.reduce((n, t) => n + t._count, 0);
  // With one type picked, its custom fields (IP address, Apple ID, …) become columns.
  const columns = f.type ? extraKeys(assets).slice(0, 8) : [];

  const sortHeader = (key: keyof typeof ASSET_SORTS, text: string) => (
    <th>
      <Link href={`/inventory${filterQuery({ ...f, sort: key })}`} className="inline-flex items-center gap-1 hover:text-fg">
        {text}
        {f.sort === key && <ArrowDown className="size-3" />}
      </Link>
    </th>
  );

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Every tagged item, where it is and who has it"
        actions={
          <Link href={`/inventory/new${f.type ? `?type=${encodeURIComponent(f.type)}` : ""}`} className="btn btn-primary">
            <Plus className="size-4" /> Add {f.type || "asset"}
          </Link>
        }
      />
      <InventoryTabs active="assets" lowStock={low} />

      <FilterTabs
        active={f.type}
        items={[
          { key: "", label: "All", href: `/inventory${filterQuery({ ...f, type: "" })}`, count: total },
          ...typeCounts.map((t) => ({ key: t.type, label: t.type, href: `/inventory${filterQuery({ ...f, type: t.type })}`, count: t._count })),
        ]}
      />

      <form className="mb-4 flex flex-wrap gap-2" action="/inventory">
        {f.type && <input type="hidden" name="type" value={f.type} />}
        {f.sort !== "tag" && <input type="hidden" name="sort" value={f.sort} />}
        <input name="q" defaultValue={f.q} placeholder="Tag, name, serial, person, room, any field…" className="input max-w-xs" />
        <select name="status" defaultValue={f.status} className="input w-auto">
          <option value="">Active (not retired)</option>
          {ASSET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
          <option value="all">All, including retired</option>
        </select>
        <select name="dept" defaultValue={f.dept} className="input w-auto">
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
        <button className="btn">Filter</button>
      </form>

      {/* Tick rows, then print their QR labels or change them all at once. */}
      <form action="/inventory/labels">
        <Section
          title={`${assets.length}${assets.length === LIMIT ? "+" : ""} item${assets.length === 1 ? "" : "s"}`}
          actions={
            <div className="flex gap-2">
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
              <option value="">Department…</option>
              {myDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <input name="bulkAssigned" placeholder="Assign to…" className="input w-40" aria-label="Assign to" />
            <label className="flex items-center gap-1.5 text-dim">
              <input type="checkbox" name="bulkUnassign" /> Unassign
            </label>
            <button formAction={bulkUpdateAssets} className="btn">
              Apply
            </button>
          </div>

          {assets.length === 0 ? (
            <Empty>
              {total === 0 && !f.q ? (
                <>
                  Nothing here yet.{" "}
                  <Link href={`/inventory/new${f.type ? `?type=${encodeURIComponent(f.type)}` : ""}`} className="link">
                    Add the first item
                  </Link>
                  .
                </>
              ) : (
                "No assets match."
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
                    {sortHeader("name", "Name")}
                    {!f.type && sortHeader("type", "Type")}
                    {sortHeader("status", "Status")}
                    {sortHeader("location", "Location")}
                    {sortHeader("assigned", "Assigned to")}
                    {columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                    <th>Department</th>
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
                        <td>
                          {a.name}
                          {(a.model || a.serialNumber) && (
                            <div className="text-xs text-dim">
                              {[a.model, a.serialNumber && `S/N ${a.serialNumber}`].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </td>
                        {!f.type && <td className="text-dim">{a.type}</td>}
                        <td>
                          <Badge value={a.status} />
                        </td>
                        <td className="text-dim">{a.location?.name ?? "—"}</td>
                        <td className="text-dim">{a.assignedTo ?? "—"}</td>
                        {columns.map((c) => (
                          <td key={c} className="text-dim">
                            {extra[c] ?? "—"}
                          </td>
                        ))}
                        <td>
                          <DeptBadge dept={a.department} />
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
  );
}
