"use client";

import { Printer } from "lucide-react";
import { useI18n } from "@/i18n/client";

export function PrintButton() {
  const { t } = useI18n();
  return (
    <button className="btn btn-primary" onClick={() => window.print()}>
      <Printer className="size-4" /> {t("Print")}
    </button>
  );
}
