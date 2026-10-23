import { DeptBadge, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { requireDepartment } from "@/lib/department";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/i18n/server";
import { createTicket } from "../actions";
import { TicketForm } from "./TicketForm";

export default async function NewTicketPage({ searchParams }: PageProps<"/tickets/new">) {
  await requireUser();
  const sp = await searchParams;
  const { t } = await getI18n();
  const assetTag = typeof sp.asset === "string" ? sp.asset : undefined;
  // Each department has its own tickets: a new one goes to the department picked on the home page.
  const current = await requireDepartment();
  if (!current.takesTickets) return <PageHeader title={t("New ticket")} subtitle={t("{dept} doesn't take tickets.", { dept: current.name })} />;

  const [department, locations, asset] = await Promise.all([
    prisma.department.findUniqueOrThrow({ where: { id: current.id }, include: { categories: { orderBy: { name: "asc" } } } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    assetTag ? prisma.asset.findFirst({ where: { tag: assetTag, departmentId: current.id } }) : null,
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("New ticket")} subtitle={<DeptBadge dept={department} />} />
      <TicketForm
        action={createTicket}
        department={department}
        locations={locations}
        defaults={{
          assetTag: asset?.tag,
          locationId: asset?.locationId ?? undefined,
          title: asset ? t("Problem with {name} ({tag})", { name: asset.name, tag: asset.tag }) : undefined,
        }}
      />
    </div>
  );
}
