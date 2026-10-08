"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { safeReturnTo, req, str } from "@/lib/format";

/** Local development only: sign in as any email without Google. */
export async function devSignIn(form: FormData) {
  if (process.env.NODE_ENV !== "development") throw new Error("Dev sign-in is disabled.");
  const email = req(form, "email");
  await signIn({ email, name: str(form, "name") ?? email.split("@")[0] });
  redirect(safeReturnTo(str(form, "returnTo")));
}
