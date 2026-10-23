import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDepartment } from "@/lib/department";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/i18n/server";
import { createTicket } from "../actions";
import { TicketForm } from "./TicketForm";

export default async function NewTicketPage({ searchParams }: PageProps<"/tickets/new">) {
  await requireUser();
  const sp = await searchParams;
  const { t } = await getI18n();
  const assetTag = typeof sp.asset === "string" ? sp.asset : undefined;

  const [departments, locations, asset, current] = await Promise.all([
    prisma.department.findMany({
      where: { takesTickets: true },
      include: { categories: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    assetTag ? prisma.asset.findUnique({ where: { tag: assetTag } }) : null,
    getDepartment(),
  ]);
  const fromQuery = typeof sp.dept === "string" ? departments.find((d) => d.slug === sp.dept)?.id : undefined;
  // Defaults to the department picked on the home page; a ticket can still go to any department.
  const fromHome = departments.find((d) => d.id === current?.id)?.id;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("New ticket")} subtitle={t("Describe the problem and pick the department that should fix it.")} />
      <TicketForm
        action={createTicket}
        departments={departments}
        locations={locations}
        defaults={{
          assetTag: asset?.tag,
          departmentId: asset?.departmentId ?? fromQuery ?? fromHome,
          locationId: asset?.locationId ?? undefined,
          title: asset ? t("Problem with {name} ({tag})", { name: asset.name, tag: asset.tag }) : undefined,
        }}
      />
    </div>
  );
}
