import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { isLocale, LOCALE_COOKIE, makeT, type Locale } from ".";

/** The language picked in the sidebar, else the browser's preferred one. */
export const getLocale = cache(async (): Promise<Locale> => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  const first = (await headers()).get("accept-language")?.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("it") ? "it" : "en";
});

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: makeT(locale) };
}
