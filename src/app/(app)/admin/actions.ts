"use server";

import { revalidatePath } from "next/cache";
import { assert, requireUser } from "@/lib/auth";
import { req, str } from "@/lib/format";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const user = await requireUser();
  assert(user.isAdmin);
  return user;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// ------------------------------------------------------------------- users

export async function updateUserAccess(userId: string, form: FormData) {
  const admin = await requireAdmin();
  const role = form.get("role") === "admin" ? "admin" : "user";
  assert(userId !== admin.id || role === "admin", "You can't remove your own admin role.");
  const departmentIds = form.getAll("departmentId").map(String);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { role } }),
    prisma.membership.deleteMany({ where: { userId } }),
    prisma.membership.createMany({ data: departmentIds.map((departmentId) => ({ userId, departmentId })) }),
  ]);
  revalidatePath("/admin");
}

/** Lets admins add staff before their first sign-in (e.g. to make them agents). */
export async function addUser(form: FormData) {
  await requireAdmin();
  const email = req(form, "email").toLowerCase();
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: str(form, "name") ?? email.split("@")[0] },
  });
  revalidatePath("/admin");
}

// ------------------------------------------------------------- departments

export async function saveDepartment(departmentId: string | null, form: FormData) {
  await requireAdmin();
  const name = req(form, "name");
  const data = {
    name,
    color: str(form, "color") ?? "#2563eb",
    description: str(form, "description"),
    takesTickets: form.get("takesTickets") === "on",
  };
  if (departmentId) await prisma.department.update({ where: { id: departmentId }, data });
  // The slug is fixed at creation: "reception" grants visitor/delivery access.
  else await prisma.department.create({ data: { ...data, slug: slugify(name) } });
  revalidatePath("/admin");
}

export async function addCategory(departmentId: string, form: FormData) {
  await requireAdmin();
  await prisma.category.create({ data: { departmentId, name: req(form, "name") } });
  revalidatePath("/admin");
}

export async function deleteCategory(categoryId: string) {
  await requireAdmin();
  await prisma.category.delete({ where: { id: categoryId } });
  revalidatePath("/admin");
}

// --------------------------------------------------------------- locations

export async function addLocation(form: FormData) {
  await requireAdmin();
  await prisma.location.create({ data: { name: req(form, "name") } });
  revalidatePath("/admin");
}

export async function deleteLocation(locationId: string) {
  await requireAdmin();
  await prisma.location.delete({ where: { id: locationId } });
  revalidatePath("/admin");
}
