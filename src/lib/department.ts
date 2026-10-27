import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { assert, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * The departments the signed-in user follows: their own, or every one for
 * admins. Each one has its own tickets, inventory and board, listed in the
 * sidebar. Memoized per request.
 */
export const myDepartments = cache(async () => {
  const user = await requireUser();
  return prisma.department.findMany({ where: user.isAdmin ? {} : { id: { in: user.departmentIds } }, orderBy: { name: "asc" } });
});

/** The department a page is about (?dept=slug), among the user's; their first one by default, the home page if they have none. */
export async function requireDepartment(slug: unknown) {
  const departments = await myDepartments();
  if (!departments.length) redirect("/");
  const department = typeof slug === "string" && slug ? departments.find((d) => d.slug === slug) : departments[0];
  if (!department) notFound();
  return department;
}

const follows = async (slug: string) => (await myDepartments()).some((d) => d.slug === slug);

/** A page that belongs to one department (monitor and hours: IT, dining: kitchen, ...); home page for everyone else. */
export async function requireDepartmentPage(slug: string) {
  if (!(await follows(slug))) redirect("/");
}

/** The same check for that page's server actions. */
export async function assertDepartment(slug: string) {
  assert(await follows(slug), "That belongs to another department.");
}
