"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { columnLabel, DEVICE_FIELDS, extraLabel, FIELD_COLUMNS, isDeviceField, isReadFromDevice, isPrinter, parseExtra, PRINTER_COLUMNS, stringifyExtra } from "@/lib/assets";
import { assert, isAgentOf, requireUser } from "@/lib/auth";
import { ASSET_STATUSES, fromLocalInput, int, label, oneOf, req, str, toLocalInput } from "@/lib/format";
import { ipField } from "@/lib/printerSnmp";
import { fillFromPrinter, refreshPrinters } from "@/lib/printers";
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

/** Applies the same change to every ticked asset in the inventory list. */
export async function bulkUpdateAssets(form: FormData) {
  const user = await requireUser();
  const tags = form.getAll("tag").map(String);
  const status = str(form, "bulkStatus");
  const locationId = str(form, "bulkLocation");
  const departmentId = str(form, "bulkDept");
  const assignedTo = str(form, "bulkAssigned");
  const unassign = form.get("bulkUnassign") === "on";
  const field = str(form, "bulkField");
  const value = str(form, "bulkValue");
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
  // "Set field…": one text column (or custom field) to the same value; empty clears it.
  const custom = field ? extraLabel(field) : null;
  const textField = field && (TEXT_FIELDS as readonly string[]).includes(field) ? (field as (typeof TEXT_FIELDS)[number]) : null;
  if (custom || textField) changes.push(value ? `set ${columnLabel(field!)} to ${value}` : `cleared ${columnLabel(field!)}`);
  if (!changes.length) return;

  const assets = await prisma.asset.findMany({ where: { tag: { in: tags } } });
  for (const a of assets) assert(isAgentOf(user, a.departmentId));
  await prisma.$transaction(
    assets.map((a) =>
      prisma.asset.update({
        where: { id: a.id },
        data: {
          ...data,
          ...(textField && (value || textField !== "name") && !(isDeviceField(textField) && isReadFromDevice(a)) ? { [textField]: value } : {}),
          ...(custom ? { extra: stringifyExtra({ ...parseExtra(a.extra), [custom]: value ?? "" }) } : {}),
          activity: { create: { actorId: user.id, body: `${changes.join(", ")} (bulk edit)` } },
        },
      }),
    ),
  );
  revalidatePath("/inventory");
}

const TEXT_FIELDS = ["name", "manufacturer", "model", "serialNumber", "assignedTo", "notes"] as const;
const DATE_FIELDS = ["purchaseDate", "warrantyUntil"] as const;

/**
 * Saves the inventory table in edit mode. Inputs are named "<assetId>|<column>"
 * and only cells that actually changed are written.
 */
export async function saveTable(form: FormData) {
  const user = await requireUser();
  const byAsset = new Map<string, Map<string, string>>();
  for (const [name, raw] of form.entries()) {
    const [id, column] = name.split("|", 2);
    if (!column || typeof raw !== "string") continue;
    if (!byAsset.has(id)) byAsset.set(id, new Map());
    byAsset.get(id)!.set(column, raw.trim());
  }

  const assets = await prisma.asset.findMany({ where: { id: { in: [...byAsset.keys()] } } });
  for (const a of assets) assert(isAgentOf(user, a.departmentId));
  const locations = new Map((await prisma.location.findMany()).map((l) => [l.id, l.name]));

  const updates = assets.flatMap((a) => {
    const cells = byAsset.get(a.id)!;
    const data: Record<string, unknown> = {};
    const changes: string[] = [];
    for (const f of TEXT_FIELDS) {
      if (!cells.has(f) || (isDeviceField(f) && isReadFromDevice(a))) continue;
      const v = cells.get(f) || null;
      if (f === "name" && !v) continue; // a name is required
      if (v !== (a[f] ?? null)) {
        data[f] = v;
        changes.push(f === "assignedTo" ? (v ? `assigned to ${v}` : "returned (unassigned)") : `changed ${columnLabel(f)}`);
      }
    }
    for (const f of DATE_FIELDS) {
      if (!cells.has(f)) continue;
      // Compare as school-time days (YYYY-MM-DD), the way the date inputs show them.
      const day = cells.get(f) || null;
      if (day !== (a[f] ? toLocalInput(a[f]).slice(0, 10) : null)) {
        data[f] = fromLocalInput(day);
        changes.push(`changed ${columnLabel(f)}`);
      }
    }
    if (cells.has("status")) {
      const v = oneOf(cells.get("status") ?? null, ASSET_STATUSES, a.status as (typeof ASSET_STATUSES)[number]);
      if (v !== a.status) {
        data.status = v;
        changes.push(`changed status to ${label(v)}`);
      }
    }
    if (cells.has("location")) {
      const v = cells.get("location") || null;
      if (v !== a.locationId && (!v || locations.has(v))) {
        data.locationId = v;
        changes.push(`moved to ${v ? locations.get(v) : "no location"}`);
      }
    }
    const extra = parseExtra(a.extra);
    let extraChanged = false;
    for (const [col, v] of cells) {
      const key = extraLabel(col);
      if (key === null || (extra[key] ?? "") === v) continue;
      extra[key] = v;
      extraChanged = true;
      changes.push(`changed ${key}`);
    }
    if (extraChanged) data.extra = stringifyExtra(extra);
    if (!changes.length) return [];
    return [
      prisma.asset.update({
        where: { id: a.id },
        data: { ...data, activity: { create: { actorId: user.id, body: `${changes.join(", ")} (table edit)` } } },
      }),
    ];
  });
  if (updates.length) await prisma.$transaction(updates);

  const back = str(form, "back");
  revalidatePath("/inventory");
  redirect(back?.startsWith("/inventory") ? back : "/inventory");
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

// ---------------------------------------------------------------- printers

export async function readPrinterDetails(assetId: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  assert(isAgentOf(user, asset.departmentId));
  try {
    await fillFromPrinter(asset, user.id);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't read the printer." };
  }
  revalidatePath(`/inventory/${asset.tag}`);
  return { ok: true, message: "Updated from the printer." };
}

/** Re-reads every printer with an IP (toner levels, page counts) in parallel. */
export async function refreshAllPrinters(): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const { total, failed } = await refreshPrinters(user.isAdmin ? {} : { departmentId: { in: user.departmentIds } });
  revalidatePath("/inventory");
  return {
    ok: failed.length === 0,
    message: `${total - failed.length} of ${total} printers updated${failed.length ? `; no answer from ${failed.join(", ")}` : ""}.`,
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
