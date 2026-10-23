"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { DEPARTMENT_COOKIE } from "@/lib/department";
import { prisma } from "@/lib/prisma";

export async function chooseDepartment(slug: string) {
  await requireUser();
  const department = await prisma.department.findUnique({ where: { slug } });
  if (department) {
    (await cookies()).set(DEPARTMENT_COOKIE, department.slug, { maxAge: 60 * 60 * 24 * 365, sameSite: "lax", path: "/" });
  }
  redirect("/");
}

/** Back to the home page's department picker. */
export async function leaveDepartment() {
  (await cookies()).delete(DEPARTMENT_COOKIE);
  redirect("/");
}
