import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { assert } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const DEPARTMENT_COOKIE = "tasis_department";

/**
 * The department picked on the home page, or null. Tickets, inventory and
 * boards show only this department's data. Memoized per request.
 */
export const getDepartment = cache(async () => {
  const slug = (await cookies()).get(DEPARTMENT_COOKIE)?.value;
  return slug ? prisma.department.findUnique({ where: { slug } }) : null;
});

/** The picked department; sends the user to the home page to pick one otherwise. */
export async function requireDepartment() {
  const department = await getDepartment();
  if (!department) redirect("/");
  return department;
}

/** A page that belongs to one department (monitor and hours: IT, dining: kitchen, ...); home page otherwise. */
export async function requireDepartmentPage(slug: string) {
  if ((await getDepartment())?.slug !== slug) redirect("/");
}

/** The same check for that page's server actions. */
export async function assertDepartment(slug: string) {
  assert((await getDepartment())?.slug === slug, "That belongs to another department.");
}
