import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, DeptBadge, Empty, Field, PageHeader, Section, TableWrap } from "@/components/ui";
import { isAgent, isAgentOf, requireUser } from "@/lib/auth";
import { fmtRelative } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { managedDepartments } from "@/lib/tickets";
import { adjustStock, createSupply, deleteSupply, updateSupply } from "../actions";
import { InventoryTabs } from "../Tabs";

export default async function SuppliesPage({ searchParams }: PageProps<"/inventory/supplies">) {
  const user = await requireUser();
  if (!isAgent(user)) notFound();
  const sp = await searchParams;
  const editId = typeof sp.edit === "string" ? sp.edit : null;

  const [supplies, departments, locations, movements] = await Promise.all([
    prisma.supply.findMany({
      where: user.isAdmin ? {} : { departmentId: { in: user.departmentIds } },
      include: { department: true, location: true },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
    }),
    managedDepartments(user),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.stockMovement.findMany({
      where: user.isAdmin ? {} : { supply: { departmentId: { in: user.departmentIds } } },
      include: { supply: true, actor: true, ticket: true },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);
  const low = supplies.filter((s) => s.quantity <= s.minQuantity);
  const sorted = [...low, ...supplies.filter((s) => s.quantity > s.minQuantity)];

  return (
    <>
      <PageHeader title="Inventory" subtitle="Consumables: toner, cables, spare parts, cleaning products…" />
      <InventoryTabs active="supplies" lowStock={low.length} />

      <Section title="Stock" className="mb-6">
        {sorted.length === 0 ? (
          <Empty>No supplies yet — add the first one below.</Empty>
        ) : (
          <TableWrap>
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Department</th>
                  <th>Location</th>
                  <th className="text-right">In stock</th>
                  <th className="text-right">Min</th>
                  <th>Add / remove</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) =>
                  editId === s.id && isAgentOf(user, s.departmentId) ? (
                    <tr key={s.id}>
                      <td colSpan={7}>
                        <form action={updateSupply.bind(null, s.id)} className="grid items-end gap-2 sm:grid-cols-6">
                          <Field label="Name" className="sm:col-span-2">
                            <input name="name" required defaultValue={s.name} className="input" />
                          </Field>
                          <Field label="SKU">
                            <input name="sku" defaultValue={s.sku ?? ""} className="input" />
                          </Field>
                          <Field label="Unit">
                            <input name="unit" defaultValue={s.unit} className="input" />
                          </Field>
                          <Field label="Min qty">
                            <input name="minQuantity" type="number" min={0} defaultValue={s.minQuantity} className="input" />
                          </Field>
                          <Field label="Location">
                            <select name="locationId" defaultValue={s.locationId ?? ""} className="input">
                              <option value="">—</option>
                              {locations.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <div className="flex gap-2 sm:col-span-6">
                            <button className="btn btn-primary">Save</button>
                            <Link href="/inventory/supplies" className="btn">
                              Cancel
                            </Link>
                            <button formAction={deleteSupply.bind(null, s.id)} className="btn btn-danger ml-auto">
                              Delete item
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={s.id} className="hover:bg-panel-muted">
                      <td>
                        <div className="font-medium">{s.name}</div>
                        {s.sku && <div className="text-xs text-dim">{s.sku}</div>}
                      </td>
                      <td>
                        <DeptBadge dept={s.department} />
                      </td>
                      <td className="text-dim">{s.location?.name ?? "—"}</td>
                      <td className="text-right tabular-nums">
                        {s.quantity <= s.minQuantity ? <Badge tone="red">{s.quantity} {s.unit}</Badge> : `${s.quantity} ${s.unit}`}
                      </td>
                      <td className="text-right text-dim tabular-nums">{s.minQuantity}</td>
                      <td>
                        <form action={adjustStock.bind(null, s.id)} className="flex gap-1.5">
                          <input name="delta" type="number" required placeholder="+10 / -2" className="input w-24" />
                          <input name="reason" placeholder="reason" className="input w-32" />
                          <button className="btn">OK</button>
                        </form>
                      </td>
                      <td>
                        <Link href={`/inventory/supplies?edit=${s.id}`} className="link text-xs">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Add supply item">
          <form action={createSupply} className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2">
              <input name="name" required placeholder="e.g. HP 508A toner – black" className="input" />
            </Field>
            <Field label="Department">
              <select name="departmentId" className="input">
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Location">
              <select name="locationId" className="input">
                <option value="">—</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="SKU / part number">
              <input name="sku" className="input" />
            </Field>
            <Field label="Unit">
              <input name="unit" defaultValue="pcs" className="input" />
            </Field>
            <Field label="Current quantity">
              <input name="quantity" type="number" min={0} defaultValue={0} className="input" />
            </Field>
            <Field label="Warn at or below">
              <input name="minQuantity" type="number" min={0} defaultValue={2} className="input" />
            </Field>
            <div className="sm:col-span-2">
              <button className="btn btn-primary">Add item</button>
            </div>
          </form>
        </Section>

        <Section title="Recent movements">
          {movements.length === 0 ? (
            <Empty>No stock changes yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">
                      <span className={m.delta < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </span>{" "}
                      {m.supply.name}
                    </div>
                    <div className="truncate text-xs text-dim">
                      {m.actor?.name ?? "—"}
                      {m.ticket ? ` · ticket #${m.ticket.number}` : m.reason ? ` · ${m.reason}` : ""}
                    </div>
                  </div>
                  <span className="text-xs whitespace-nowrap text-dim">{fmtRelative(m.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
