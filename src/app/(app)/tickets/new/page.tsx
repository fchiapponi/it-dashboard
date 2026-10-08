import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTicket } from "../actions";
import { TicketForm } from "./TicketForm";

export default async function NewTicketPage({ searchParams }: PageProps<"/tickets/new">) {
  await requireUser();
  const sp = await searchParams;
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
      <PageHeader title="New ticket" subtitle="Describe the problem and pick the department that should fix it." />
      <TicketForm
        action={createTicket}
        departments={departments}
        locations={locations}
        defaults={{
          assetTag: asset?.tag,
          departmentId: asset?.departmentId ?? (typeof sp.dept === "string" ? departments.find((d) => d.slug === sp.dept)?.id : undefined),
          locationId: asset?.locationId ?? undefined,
          title: asset ? `Problem with ${asset.name} (${asset.tag})` : undefined,
        }}
      />
    </div>
  );
}
