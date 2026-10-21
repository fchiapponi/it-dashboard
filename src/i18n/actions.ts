"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from ".";

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
