import { it } from "./it";

// The app is written in English; it.ts maps each English string to Italian.
// Keys are the English text itself, so a string missing from it.ts fails the
// type check instead of showing up untranslated.

export const LOCALES = ["en", "it"] as const;
export type Locale = (typeof LOCALES)[number];
export type Message = keyof typeof it;
export type Vars = Record<string, string | number>;
export type T = (message: Message, vars?: Vars) => string;

export const LOCALE_COOKIE = "lang";

/** Locale for Intl dates and numbers: Swiss formats, like the school. */
export const INTL: Record<Locale, string> = { en: "en-GB", it: "it-CH" };

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);

/** Whether a string from data (a stored label, say) has a translation. */
export const isMessage = (text: string): text is Message => Object.hasOwn(it, text);

/** Translates `message`, filling `{name}` placeholders from `vars`. */
export function translate(locale: Locale, message: Message, vars?: Vars): string {
  const text: string = locale === "it" ? it[message] : message;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

export const makeT =
  (locale: Locale): T =>
  (message, vars) =>
    translate(locale, message, vars);
