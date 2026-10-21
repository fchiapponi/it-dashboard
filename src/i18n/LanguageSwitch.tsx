"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALES } from ".";
import { setLocale } from "./actions";
import { useI18n } from "./client";
import { cn } from "@/lib/utils";

export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className={cn("inline-flex rounded-lg border border-line p-0.5 text-xs font-medium", pending && "opacity-60", className)} title={t("Language")}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={l === locale}
          onClick={() =>
            startTransition(async () => {
              await setLocale(l);
              router.refresh();
            })
          }
          className={cn("rounded-md px-2 py-0.5 uppercase", l === locale ? "bg-panel-muted text-fg" : "text-dim hover:text-fg")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
