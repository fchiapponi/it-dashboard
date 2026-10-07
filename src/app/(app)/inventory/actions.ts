"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { stringifyExtra } from "@/lib/assets";
import { assert, isAgentOf, requireUser } from "@/lib/auth";
import { ASSET_STATUSES, fromLocalInput, int, label, oneOf, req, str } from "@/lib/format";
import { prisma } from "@/lib/prisma";

async function nextAssetTag() {
  const last = await prisma.asset.findFirst({ where: { tag: { startsWith: "TAS-" } }, orderBy: { tag: "desc" } });
  const n = last ? Number.parseInt(last.tag.slice(4), 10) + 1 : 1;
  return `TAS-${String(Number.isFinite(n) ? n : 1).padStart(5, "0")}`;
}

function extraFields(form: FormData) {
  const keys = form.getAll("extraKey").map(String);
  const values = form.getAll("extraValue").map(String);
  return stringifyExtra(Object.fromEntries(keys.map((k, i) => [k.trim(), (values[i] ?? "").trim()])));
}

function assetFields(form: FormData) {
  return {
    name: req(form, "name"),
    type: req(form, "type"),
    manufacturer: str(form, "manufacturer"),
    model: str(form, "model"),
    serialNumber: str(form, "serialNumber"),
    status: oneOf(str(form, "status"), ASSET_STATUSES, "in_use"),
    departmentId: req(form, "departmentId"),
    locationId: str(form, "locationId"),
    assignedTo: str(form, "assignedTo"),
    purchaseDate: fromLocalInput(str(form, "purchaseDate")),
    warrantyUntil: fromLocalInput(str(form, "warrantyUntil")),
    notes: str(form, "notes"),
    extra: extraFields(form),
  };
}

export async function createAsset(form: FormData) {
  const user = await requireUser();
  const data = assetFields(form);
  assert(isAgentOf(user, data.departmentId));
  const tag = str(form, "tag")?.toUpperCase() ?? (await nextAssetTag());
  if (await prisma.asset.findUnique({ where: { tag } })) throw new Error(`Tag ${tag} is already in use.`);

  await prisma.asset.create({
    data: { ...data, tag, activity: { create: { actorId: user.id, body: "added to inventory" } } },
  });
  // "Save & add another" opens a new form pre-filled like this one.
  if (form.get("then") === "another") redirect(`/inventory/new?copy=${tag}&added=${tag}`);
  redirect(`/inventory/${tag}`);
}

const TRACKED: [keyof ReturnType<typeof assetFields>, string][] = [
  ["status", "status"],
  ["assignedTo", "assigned to"],
  ["locationId", "location"],
  ["departmentId", "department"],
];

export async function updateAsset(assetId: string, form: FormData) {
  const user = await requireUser();
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId }, include: { location: true } });
  const data = assetFields(form);
  assert(isAgentOf(user, asset.departmentId) && isAgentOf(user, data.departmentId));

  const changes: string[] = [];
  for (const [key, what] of TRACKED) {
    if ((asset[key] ?? null) === (data[key] ?? null)) continue;
    if (key === "status") changes.push(`changed status to ${label(data.status)}`);
    else if (key === "assignedTo") changes.push(data.assignedTo ? `assigned to ${data.assignedTo}` : "returned (unassigned)");
    else if (key === "locationId") {
      const loc = data.locationId ? await prisma.location.findUnique({ where: { id: data.locationId } }) : null;
      changes.push(`moved to ${loc?.name ?? "no location"}`);
    } else changes.push(`changed ${what}`);
  }

  await prisma.asset.update({
    where: { id: asset.id },
    data: {
      ...data,
      activity: { create: { actorId: user.id, body: changes.length ? changes.join(", ") : "edited details" } },
    },
  });
  revalidatePath(`/inventory/${asset.tag}`);
}

export async function addAssetNote(assetId: string, form: FormData) {
  const user = await requireUser();
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  assert(isAgentOf(user, asset.departmentId));
  await prisma.assetActivity.create({ data: { assetId, actorId: user.id, body: req(form, "body") } });
  revalidatePath(`/inventory/${asset.tag}`);
}

/** Applies the same change to every ticked asset in the inventory list. */
export async function bulkUpdateAssets(form: FormData) {
  const user = await requireUser();
  const tags = form.getAll("tag").map(String);
  const status = str(form, "bulkStatus");
  const locationId = str(form, "bulkLocation");
  const departmentId = str(form, "bulkDept");
  const assignedTo = str(form, "bulkAssigned");
  const unassign = form.get("bulkUnassign") === "on";
  if (!tags.length) return;

  const data: { status?: string; locationId?: string | null; departmentId?: string; assignedTo?: string | null } = {};
  const changes: string[] = [];
  if (status) {
    data.status = oneOf(status, ASSET_STATUSES, "in_use");
    changes.push(`changed status to ${label(data.status)}`);
  }
  if (locationId) {
    const loc = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });
    data.locationId = loc.id;
    changes.push(`moved to ${loc.name}`);
  }
  if (departmentId) {
    assert(isAgentOf(user, departmentId));
    data.departmentId = departmentId;
    changes.push("changed department");
  }
  if (unassign) {
    data.assignedTo = null;
    changes.push("returned (unassigned)");
  } else if (assignedTo) {
    data.assignedTo = assignedTo;
    changes.push(`assigned to ${assignedTo}`);
  }
  if (!changes.length) return;

  const assets = await prisma.asset.findMany({ where: { tag: { in: tags } } });
  for (const a of assets) assert(isAgentOf(user, a.departmentId));
  await prisma.$transaction(
    assets.map((a) =>
      prisma.asset.update({
        where: { id: a.id },
        data: { ...data, activity: { create: { actorId: user.id, body: `${changes.join(", ")} (bulk edit)` } } },
      }),
    ),
  );
  revalidatePath("/inventory");
}

/** Permanently removes the ticked assets (retiring is usually the better choice). */
export async function deleteAssets(form: FormData) {
  const user = await requireUser();
  const tags = form.getAll("tag").map(String);
  const assets = await prisma.asset.findMany({ where: { tag: { in: tags } } });
  for (const a of assets) assert(isAgentOf(user, a.departmentId));
  await prisma.asset.deleteMany({ where: { id: { in: assets.map((a) => a.id) } } });
  revalidatePath("/inventory");
}

// ---------------------------------------------------------------- supplies

export async function createSupply(form: FormData) {
  const user = await requireUser();
  const departmentId = req(form, "departmentId");
  assert(isAgentOf(user, departmentId));
  const quantity = Math.max(0, int(form, "quantity") ?? 0);
  await prisma.supply.create({
    data: {
      name: req(form, "name"),
      sku: str(form, "sku"),
      unit: str(form, "unit") ?? "pcs",
      minQuantity: Math.max(0, int(form, "minQuantity") ?? 0),
      quantity,
      departmentId,
      locationId: str(form, "locationId"),
      movements: quantity ? { create: { delta: quantity, reason: "Initial stock", actorId: user.id } } : undefined,
    },
  });
  revalidatePath("/inventory/supplies");
}

/** Adds (positive) or removes (negative) stock and records why. */
export async function adjustStock(supplyId: string, form: FormData) {
  const user = await requireUser();
  const supply = await prisma.supply.findUniqueOrThrow({ where: { id: supplyId } });
  assert(isAgentOf(user, supply.departmentId));
  const delta = int(form, "delta");
  if (!delta) return;
  await prisma.$transaction([
    prisma.supply.update({ where: { id: supplyId }, data: { quantity: { increment: delta } } }),
    prisma.stockMovement.create({ data: { supplyId, delta, reason: str(form, "reason"), actorId: user.id } }),
  ]);
  revalidatePath("/inventory/supplies");
}

export async function updateSupply(supplyId: string, form: FormData) {
  const user = await requireUser();
  const supply = await prisma.supply.findUniqueOrThrow({ where: { id: supplyId } });
  assert(isAgentOf(user, supply.departmentId));
  await prisma.supply.update({
    where: { id: supplyId },
    data: {
      name: req(form, "name"),
      sku: str(form, "sku"),
      unit: str(form, "unit") ?? "pcs",
      minQuantity: Math.max(0, int(form, "minQuantity") ?? 0),
      locationId: str(form, "locationId"),
    },
  });
  revalidatePath("/inventory/supplies");
}

export async function deleteSupply(supplyId: string) {
  const user = await requireUser();
  const supply = await prisma.supply.findUniqueOrThrow({ where: { id: supplyId } });
  assert(isAgentOf(user, supply.departmentId));
  await prisma.supply.delete({ where: { id: supplyId } });
  revalidatePath("/inventory/supplies");
}
