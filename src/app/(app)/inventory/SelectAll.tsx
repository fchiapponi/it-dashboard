"use client";

import { useI18n } from "@/i18n/client";

/** Header checkbox that ticks every row checkbox (name="tag") in its form. */
export function SelectAll() {
  const { t } = useI18n();
  return (
    <input
      type="checkbox"
      aria-label={t("Select all")}
      onChange={(e) => {
        for (const box of e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="tag"]') ?? []) box.checked = e.currentTarget.checked;
      }}
    />
  );
}
