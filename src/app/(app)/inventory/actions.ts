"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assert, isAgentOf, requireUser } from "@/lib/auth";
import { ASSET_STATUSES, fromLocalInput, int, label, oneOf, req, str } from "@/lib/format";
import { prisma } from "@/lib/prisma";

async function nextAssetTag() {
  const last = await prisma.asset.findFirst({ where: { tag: { startsWith: "TAS-" } }, orderBy: { tag: "desc" } });
  const n = last ? Number.parseInt(last.tag.slice(4), 10) + 1 : 1;
  return `TAS-${String(Number.isFinite(n) ? n : 1).padStart(5, "0")}`;
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
