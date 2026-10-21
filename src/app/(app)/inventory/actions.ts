"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { defaultColumns, DEVICE_FIELDS, extraLabel, FIELD_COLUMNS, isReadFromDevice, isPrinter, parseExtra, PRINTER_COLUMNS, stringifyExtra } from "@/lib/assets";
import { assert, isAgentOf, requireUser } from "@/lib/auth";
import { ASSET_STATUSES, fromLocalInput, int, label, oneOf, req, str } from "@/lib/format";
import { ipField } from "@/lib/printerSnmp";
import { fillFromPrinter, refreshPrinters } from "@/lib/printers";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/i18n/server";

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

  const asset = await prisma.asset.create({
    data: { ...data, tag, activity: { create: { actorId: user.id, body: "added to inventory" } } },
  });
  // A new printer with an IP gets its model, serial and toner filled in right away.
  if (isPrinter(asset) && ipField(parseExtra(asset.extra))) await fillFromPrinter(asset, user.id).catch(() => {});
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
  // What the printer reported stays as reported.
  if (isReadFromDevice(asset)) for (const f of DEVICE_FIELDS) data[f] = asset[f];

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

/** Permanently removes the ticked assets (retiring is usually the better choice). */
export async function deleteAssets(form: FormData) {
  const user = await requireUser();
  const tags = form.getAll("tag").map(String);
  const assets = await prisma.asset.findMany({ where: { tag: { in: tags } } });
  for (const a of assets) assert(isAgentOf(user, a.departmentId));
  await prisma.asset.deleteMany({ where: { id: { in: assets.map((a) => a.id) } } });
  revalidatePath("/inventory");
}

// ------------------------------------------------------------ list columns

/**
 * Saves the columns of a department's list for one type. `renames` maps old
 * custom field labels to new ones; the field is renamed on every item of the
 * list so its values follow the column.
 */
export async function saveListColumns(departmentId: string, type: string, columns: string[], renames: [string, string][]) {
  const user = await requireUser();
  assert(isAgentOf(user, departmentId));
  const valid = columns.filter((c, i) => columns.indexOf(c) === i && (c in FIELD_COLUMNS || PRINTER_COLUMNS.includes(c) || !!extraLabel(c)?.trim()));

  const changed = renames.filter(([from, to]) => from && to && from !== to);
  if (changed.length) {
    const assets = await prisma.asset.findMany({ where: { departmentId, type, extra: { not: null } } });
    await prisma.$transaction(
      assets.flatMap((a) => {
        const extra = parseExtra(a.extra);
        if (!changed.some(([from]) => from in extra)) return [];
        // Rebuild the object so a renamed field keeps its position.
        const next = Object.fromEntries(Object.entries(extra).map(([k, v]) => [changed.find(([from]) => from === k)?.[1] ?? k, v]));
        return [prisma.asset.update({ where: { id: a.id }, data: { extra: stringifyExtra(next) } })];
      }),
    );
  }

  await prisma.assetList.upsert({
    where: { departmentId_type: { departmentId, type } },
    create: { departmentId, type, columns: JSON.stringify(valid) },
    update: { columns: JSON.stringify(valid) },
  });
  revalidatePath("/inventory");
}

/** Adds an empty list to a department's inventory and opens it. */
export async function createList(form: FormData) {
  const user = await requireUser();
  const departmentId = req(form, "departmentId");
  assert(isAgentOf(user, departmentId));
  const type = req(form, "type");
  const dept = await prisma.department.findUniqueOrThrow({ where: { id: departmentId } });

  await prisma.assetList.upsert({
    where: { departmentId_type: { departmentId, type } },
    create: { departmentId, type, columns: JSON.stringify(defaultColumns(type, [])) },
    update: {},
  });
  revalidatePath("/inventory");
  redirect(`/inventory?dept=${dept.slug}&type=${encodeURIComponent(type)}`);
}

/**
 * Renames a department's list: every item of it gets the new type, and the
 * list's columns go with it. Renaming onto an existing list merges the two,
 * keeping that list's columns.
 */
export async function renameList(form: FormData) {
  const user = await requireUser();
  const departmentId = req(form, "departmentId");
  assert(isAgentOf(user, departmentId));
  const from = req(form, "from");
  const to = req(form, "type");
  const dept = await prisma.department.findUniqueOrThrow({ where: { id: departmentId } });

  if (to !== from) {
    const [list, target] = await Promise.all([
      prisma.assetList.findUnique({ where: { departmentId_type: { departmentId, type: from } } }),
      prisma.assetList.findUnique({ where: { departmentId_type: { departmentId, type: to } } }),
    ]);
    await prisma.$transaction([
      prisma.asset.updateMany({ where: { departmentId, type: from }, data: { type: to } }),
      ...(list ? [target ? prisma.assetList.delete({ where: { id: list.id } }) : prisma.assetList.update({ where: { id: list.id }, data: { type: to } })] : []),
    ]);
  }
  revalidatePath("/inventory");
  redirect(`/inventory?dept=${dept.slug}&type=${encodeURIComponent(to)}`);
}

// ---------------------------------------------------------------- printers

export async function readPrinterDetails(assetId: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  assert(isAgentOf(user, asset.departmentId));
  const { t } = await getI18n();
  try {
    await fillFromPrinter(asset, user.id);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : t("Couldn't read the printer.") };
  }
  revalidatePath(`/inventory/${asset.tag}`);
  return { ok: true, message: t("Updated from the printer.") };
}

/** Re-reads every printer with an IP (toner levels, page counts) in parallel. */
export async function refreshAllPrinters(): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const { total, failed } = await refreshPrinters(user.isAdmin ? {} : { departmentId: { in: user.departmentIds } });
  revalidatePath("/inventory");
  const { t } = await getI18n();
  const updated = t("{n} of {total} printers updated", { n: total - failed.length, total });
  return {
    ok: failed.length === 0,
    message: failed.length ? `${updated}; ${t("no answer from {tags}", { tags: failed.join(", ") })}.` : `${updated}.`,
  };
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
