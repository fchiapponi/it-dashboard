import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/i18n/server";
import { createTicket } from "../actions";
import { TicketForm } from "./TicketForm";

export default async function NewTicketPage({ searchParams }: PageProps<"/tickets/new">) {
  await requireUser();
  const sp = await searchParams;
  const { t } = await getI18n();
  const assetTag = typeof sp.asset === "string" ? sp.asset : undefined;

  const [departments, locations, asset] = await Promise.all([
    prisma.department.findMany({
      where: { takesTickets: true },
      include: { categories: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    assetTag ? prisma.asset.findUnique({ where: { tag: assetTag } }) : null,
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("New ticket")} subtitle={t("Describe the problem and pick the department that should fix it.")} />
      <TicketForm
        action={createTicket}
        departments={departments}
        locations={locations}
        defaults={{
          assetTag: asset?.tag,
          departmentId: asset?.departmentId ?? (typeof sp.dept === "string" ? departments.find((d) => d.slug === sp.dept)?.id : undefined),
          locationId: asset?.locationId ?? undefined,
          title: asset ? t("Problem with {name} ({tag})", { name: asset.name, tag: asset.tag }) : undefined,
        }}
      />
    </div>
  );
}
