import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import {
  columnLabel,
  customKeys,
  defaultColumns,
  extraColumn,
  extraLabel,
  FIELD_COLUMNS,
  isPrinter,
  isReadOnlyColumn,
  PRINTER_COLUMNS,
  savedColumns,
} from "@/lib/assets";
import { isAgentOf, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ColumnEditor } from "./ColumnEditor";

/** Choose, order and rename the columns of one list (?dept=it&type=Printer). */
export default async function ListColumnsPage({ searchParams }: PageProps<"/inventory/columns">) {
  const user = await requireUser();
  const sp = await searchParams;
  const type = typeof sp.type === "string" ? sp.type : "";
  const dept = typeof sp.dept === "string" ? await prisma.department.findUnique({ where: { slug: sp.dept } }) : null;
  if (!dept || !type || !isAgentOf(user, dept.id)) notFound();

  const [saved, assets] = await Promise.all([
    savedColumns(dept.id, type),
    prisma.asset.findMany({ where: { departmentId: dept.id, type }, select: { extra: true } }),
  ]);
  const current = saved ?? defaultColumns(type, assets);
  // Only custom field columns can be renamed; what the printer reports is read-only.
  const toColumn = (key: string) => ({
    key,
    label: columnLabel(key),
    custom: extraLabel(key) !== null,
    note: isReadOnlyColumn(key) ? "read from the printer" : extraLabel(key) !== null ? "custom field" : "",
  });
  const available = [
    ...Object.keys(FIELD_COLUMNS),
    ...customKeys(type, assets).map(extraColumn),
    ...(isPrinter({ type }) ? PRINTER_COLUMNS : []),
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Columns · ${dept.name} ${type}`} subtitle="Pick what this list shows. Hiding a column never deletes its data." />
      <ColumnEditor
        departmentId={dept.id}
        type={type}
        backHref={`/inventory?dept=${dept.slug}&type=${encodeURIComponent(type)}`}
        initial={current.map(toColumn)}
        available={available.map(toColumn)}
      />
    </div>
  );
}
