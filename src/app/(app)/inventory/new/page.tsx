import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { Field, PageHeader } from "@/components/ui";
import { fieldLabelsFor, hasAssignedTo, parseExtra } from "@/lib/assets";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { managedDepartments } from "@/lib/tickets";
import { getI18n } from "@/i18n/server";
import { createAsset, createList } from "../actions";
import { AssetFields, ASSET_TYPES } from "../AssetFields";

/**
 * ?type=iPad starts the form with that type; ?copy=TAG pre-fills it from an
 * existing asset (everything except what is unique to one device).
 */
export default async function NewAssetPage({ searchParams }: PageProps<"/inventory/new">) {
  const user = await requireUser();
  const sp = await searchParams;
  const { t } = await getI18n();
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const copyTag = one("copy")?.toUpperCase();
  const added = one("added")?.toUpperCase();

  const [departments, locations, source] = await Promise.all([
    managedDepartments(user),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    copyTag ? prisma.asset.findUnique({ where: { tag: copyTag } }) : null,
  ]);
  if (!departments.length) notFound();

  const type = source?.type ?? one("type");
  const departmentId = source?.departmentId ?? departments.find((d) => d.slug === one("dept"))?.id;

  // ?newList=1 only names a new, empty list; its items are added from the list.
  if (one("newList") === "1") {
    const dept = departments.find((d) => d.id === departmentId) ?? departments[0];
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title={t("New list")} subtitle={t("A new list in {dept}'s inventory (e.g. iPad, Laptop, Projector).", { dept: dept.name })} />
        <form action={createList} className="card space-y-6 p-6">
          <input type="hidden" name="departmentId" value={dept.id} />
          <Field label={t("Name")}>
            <input name="type" required autoFocus list="asset-types" className="input" />
            <datalist id="asset-types">
              {ASSET_TYPES.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </Field>
          <div className="flex justify-end gap-2">
            <Link href={`/inventory?dept=${dept.slug}`} className="btn">
              {t("Cancel")}
            </Link>
            <button className="btn btn-primary">{t("Add list")}</button>
          </div>
        </form>
      </div>
    );
  }
  const defaults = source
    ? {
        name: source.name,
        type: source.type,
        manufacturer: source.manufacturer,
        model: source.model,
        status: source.status,
        departmentId: source.departmentId,
        locationId: source.locationId,
        purchaseDate: source.purchaseDate,
        warrantyUntil: source.warrantyUntil,
      }
    : { type: type ?? undefined, departmentId };
  // Offer the custom fields of similar assets as empty rows (names only, not
  // values like an IP address or Apple ID).
  const fieldLabels = [...new Set([...Object.keys(parseExtra(source?.extra)), ...(await fieldLabelsFor(type, departmentId))])];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={type ? t("Add {type}", { type }) : t("Add asset")}
        subtitle={t("A tag is generated automatically; print its QR label from the asset page or the list.")}
      />
      {added && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CircleCheck className="size-4" />
          <span>
            <Link href={`/inventory/${added}`} className="font-mono font-medium underline">
              {added}
            </Link>{" "}
            {t("added. The form below is pre-filled for the next one.")}
          </span>
        </div>
      )}
      <form action={createAsset} className="card space-y-6 p-6">
        {/* key resets the uncontrolled inputs after each "add another" */}
        <AssetFields
          key={added ?? "new"}
          a={defaults}
          departments={departments}
          locations={locations}
          isNew
          fieldLabels={fieldLabels}
          showAssignedTo={type && departmentId ? await hasAssignedTo(departmentId, type) : true}
        />
        <div className="flex flex-wrap justify-end gap-2">
          {/* first in the DOM so Enter adds the asset; shown second */}
          <button className="btn btn-primary">{t("Add asset")}</button>
          <button name="then" value="another" className="btn order-first">
            {t("Save & add another")}
          </button>
        </div>
      </form>
    </div>
  );
}
