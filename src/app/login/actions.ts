"use server";

import { redirect } from "next/navigation";
import { emailSignInEnabled, signIn } from "@/lib/auth";
import { safeReturnTo, req, str } from "@/lib/format";

/** Signs in as an email without Google: in development, or while GOOGLE_SIGNIN="off". */
export async function emailSignIn(form: FormData) {
  if (!emailSignInEnabled()) throw new Error("Email sign-in is disabled.");
  const email = req(form, "email").toLowerCase();
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN?.toLowerCase();
  // In development any email works; on the server it must be a school address.
  if (process.env.NODE_ENV !== "development" && domain && !email.endsWith(`@${domain}`)) {
    redirect(`/login?error=domain&returnTo=${encodeURIComponent(safeReturnTo(str(form, "returnTo")))}`);
  }
  await signIn({ email, name: str(form, "name") ?? email.split("@")[0] });
  redirect(safeReturnTo(str(form, "returnTo")));
}
