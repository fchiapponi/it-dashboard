import { notFound } from "next/navigation";
import { X } from "lucide-react";
import { Badge, Field, FilterTabs, PageHeader, Section, TableWrap } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fmtRelative } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { addCategory, addLocation, addUser, deleteCategory, deleteLocation, saveDepartment, updateUserAccess } from "./actions";

const TABS = ["people", "departments", "locations"] as const;

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const user = await requireUser();
  if (!user.isAdmin) notFound();
  const tabParam = (await searchParams).tab;
  const tab = TABS.find((t) => t === tabParam) ?? "people";

  return (
    <>
      <PageHeader title="Admin" subtitle="Who can do what, departments, categories and places" />
      <FilterTabs
        active={tab}
        items={[
          { key: "people", label: "People & roles", href: "/admin" },
          { key: "departments", label: "Departments", href: "/admin?tab=departments" },
          { key: "locations", label: "Locations", href: "/admin?tab=locations" },
        ]}
      />
      {tab === "people" && <People />}
      {tab === "departments" && <Departments />}
      {tab === "locations" && <Locations />}
    </>
  );
}

async function People() {
  const [users, departments] = await Promise.all([
    prisma.user.findMany({ include: { memberships: true }, orderBy: [{ role: "asc" }, { name: "asc" }] }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <p className="text-sm text-dim">
        Everyone at the school can sign in and open tickets. Ticking a department makes that person an <b>agent</b> for it: they
        work its ticket queue and manage its inventory. Members of <b>Reception</b> handle visitors and deliveries.
      </p>
      <Section>
        <TableWrap>
          <table className="table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Departments</th>
                <th>Admin</th>
                <th>Last sign-in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const formId = `user-${u.id}`;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-dim">{u.email}</div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {departments.map((d) => (
                          <label key={d.id} className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                            <input
                              form={formId}
                              type="checkbox"
                              name="departmentId"
                              value={d.id}
                              defaultChecked={u.memberships.some((m) => m.departmentId === d.id)}
                            />
                            {d.name}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td>
                      <input form={formId} type="checkbox" name="role" value="admin" defaultChecked={u.role === "admin"} aria-label="Admin" />
                    </td>
                    <td className="text-xs whitespace-nowrap text-dim">
                      {u.lastLoginAt ? fmtRelative(u.lastLoginAt) : <Badge>Never</Badge>}
                    </td>
                    <td>
                      <form id={formId} action={updateUserAccess.bind(null, u.id)}>
                        <button className="btn">Save</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Section>
      <Section title="Add a person before their first sign-in">
        <form action={addUser} className="flex flex-wrap items-end gap-3 p-4">
          <Field label="School email">
            <input name="email" type="email" required className="input w-72" />
          </Field>
          <Field label="Name">
            <input name="name" className="input w-56" />
          </Field>
          <button className="btn btn-primary">Add</button>
        </form>
      </Section>
    </div>
  );
}

function DepartmentForm({ d }: { d?: { id: string; name: string; color: string; description: string | null; takesTickets: boolean } }) {
  return (
    <form action={saveDepartment.bind(null, d?.id ?? null)} className="grid items-end gap-3 p-4 sm:grid-cols-[1fr_80px_2fr_auto_auto]">
      <Field label="Name">
        <input name="name" required defaultValue={d?.name} className="input" />
      </Field>
      <Field label="Color">
        <input name="color" type="color" defaultValue={d?.color ?? "#2563eb"} className="input h-9 p-1" />
      </Field>
      <Field label="Description">
        <input name="description" defaultValue={d?.description ?? ""} className="input" />
      </Field>
      <label className="flex items-center gap-2 pb-2 text-sm whitespace-nowrap">
        <input type="checkbox" name="takesTickets" defaultChecked={d?.takesTickets ?? true} /> Takes tickets
      </label>
      <button className={d ? "btn" : "btn btn-primary"}>{d ? "Save" : "Add department"}</button>
    </form>
  );
}

async function Departments() {
  const departments = await prisma.department.findMany({
    include: { categories: { orderBy: { name: "asc" } }, _count: { select: { memberships: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-6">
      {departments.map((d) => (
        <Section
          key={d.id}
          title={
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: d.color }} /> {d.name}
              <span className="font-normal text-dim">· {d._count.memberships} agents</span>
            </span>
          }
        >
          <DepartmentForm d={d} />
          {d.takesTickets && (
            <div className="border-t border-line p-4">
              <div className="label">Ticket categories</div>
              <div className="mb-3 flex flex-wrap gap-2">
                {d.categories.map((c) => (
                  <form key={c.id} action={deleteCategory.bind(null, c.id)}>
                    <button className="flex items-center gap-1 rounded-full bg-panel-muted px-2.5 py-1 text-xs hover:text-danger" title="Remove">
                      {c.name} <X className="size-3" />
                    </button>
                  </form>
                ))}
              </div>
              <form action={addCategory.bind(null, d.id)} className="flex gap-2">
                <input name="name" required placeholder="New category" className="input max-w-60" />
                <button className="btn">Add</button>
              </form>
            </div>
          )}
        </Section>
      ))}
      <Section title="New department">
        <DepartmentForm />
      </Section>
    </div>
  );
}

async function Locations() {
  const locations = await prisma.location.findMany({ orderBy: { name: "asc" } });
  return (
    <Section title="Buildings and rooms">
      <ul className="divide-y divide-line">
        {locations.map((l) => (
          <li key={l.id} className="flex items-center justify-between px-4 py-2 text-sm">
            {l.name}
            <form action={deleteLocation.bind(null, l.id)}>
              <button className="btn btn-danger px-2" title="Delete">
                <X className="size-4" />
              </button>
            </form>
          </li>
        ))}
      </ul>
      <form action={addLocation} className="flex gap-2 border-t border-line p-4">
        <input name="name" required placeholder="e.g. Palazzo Main – Room 101" className="input max-w-sm" />
        <button className="btn btn-primary">Add location</button>
      </form>
    </Section>
  );
}
