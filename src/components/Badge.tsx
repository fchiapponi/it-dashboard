"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import { label, TONES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TONE_CLASSES } from "./tones";

/** Pill for a status/priority key; its label and color come from lib/format. */
export function Badge({ value, tone, children }: { value?: string; tone?: keyof typeof TONE_CLASSES; children?: ReactNode }) {
  const { locale } = useI18n();
  const t = tone ?? (value ? TONES[value] : undefined) ?? "gray";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONE_CLASSES[t])}>
      {children ?? (value ? label(value, locale) : null)}
    </span>
  );
}
