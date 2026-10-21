"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { makeT, type Locale } from ".";

const LocaleContext = createContext<Locale>("en");

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const locale = useContext(LocaleContext);
  return useMemo(() => ({ locale, t: makeT(locale) }), [locale]);
}
