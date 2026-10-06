import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Printer } from "lucide-react";
import type { Prisma } from "@/generated/prisma";
import { Badge, DeptBadge, Empty, PageHeader, Section, TableWrap } from "@/components/ui";
import { isAgent, requireUser } from "@/lib/auth";
import { ASSET_STATUSES, label } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { lowStockCount } from "@/lib/tickets";
import { InventoryTabs } from "./Tabs";

export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  const user = await requireUser();
  if (!isAgent(user)) notFound();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const type = typeof sp.type === "string" ? sp.type : "";
  const dept = typeof sp.dept === "string" ? sp.dept : "";

  const where: Prisma.AssetWhereInput[] = [];
  if (q)
    where.push({
      OR: [
        { tag: { contains: q } },
        { name: { contains: q } },
        { serialNumber: { contains: q } },
        { assignedTo: { contains: q } },
        { model: { contains: q } },
      ],
    });
  if (status) where.push({ status });
  else where.push({ status: { not: "retired" } });
  if (type) where.push({ type });
  if (dept) where.push({ department: { slug: dept } });

  const [assets, types, departments, low] = await Promise.all([
    prisma.asset.findMany({ where: { AND: where }, include: { department: true, location: true }, orderBy: { tag: "asc" }, take: 500 }),
    prisma.asset.findMany({ distinct: ["type"], select: { type: true }, orderBy: { type: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    lowStockCount(user.isAdmin ? undefined : user.departmentIds),
  ]);

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Every tagged item, where it is and who has it"
        actions={
          <Link href="/inventory/new" className="btn btn-primary">
            <Plus className="size-4" /> Add asset
          </Link>
        }
      />
      <InventoryTabs active="assets" lowStock={low} />

      <form className="mb-4 flex flex-wrap gap-2" action="/inventory">
        <input name="q" defaultValue={q} placeholder="Tag, name, serial, person…" className="input max-w-xs" />
        <select name="type" defaultValue={type} className="input w-auto">
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t.type}>{t.type}</option>
          ))}
        </select>
        <select name="status" defaultValue={status} className="input w-auto">
          <option value="">Active (not retired)</option>
          {ASSET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <select name="dept" defaultValue={dept} className="input w-auto">
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
        <button className="btn">Filter</button>
      </form>

      {/* Ticking rows and pressing "Print labels" opens a printable QR sheet. */}
      <form action="/inventory/labels">
        <Section
          title={`${assets.length} asset${assets.length === 1 ? "" : "s"}`}
          actions={
            <button className="btn">
              <Printer className="size-4" /> Print labels for selected
            </button>
          }
        >
          {assets.length === 0 ? (
            <Empty>No assets match.</Empty>
          ) : (
            <TableWrap>
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-8" />
                    <th>Tag</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Location</th>
                    <th>Assigned to</th>
                    <th>Department</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
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
                        {a.serialNumber && <div className="text-xs text-dim">S/N {a.serialNumber}</div>}
                      </td>
                      <td className="text-dim">{a.type}</td>
                      <td>
                        <Badge value={a.status} />
                      </td>
                      <td className="text-dim">{a.location?.name ?? "—"}</td>
                      <td className="text-dim">{a.assignedTo ?? "—"}</td>
                      <td>
                        <DeptBadge dept={a.department} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Section>
      </form>
    </>
  );
}
