import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { managedDepartments } from "@/lib/tickets";
import { createAsset } from "../actions";
import { AssetFields } from "../AssetFields";

export default async function NewAssetPage() {
  const user = await requireUser();
  const [departments, locations] = await Promise.all([managedDepartments(user), prisma.location.findMany({ orderBy: { name: "asc" } })]);
  if (!departments.length) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add asset" subtitle="A tag is generated automatically; print its QR label from the asset page." />
      <form action={createAsset} className="card space-y-6 p-6">
        <AssetFields departments={departments} locations={locations} isNew />
        <div className="flex justify-end">
          <button className="btn btn-primary">Add asset</button>
        </div>
      </form>
    </div>
  );
}
