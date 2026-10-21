"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { LABEL_FORMAT_COOKIE, LABEL_FORMATS, labelsHref } from "./format";

/** Asks for the label format in a popup, then opens the labels page and its print dialog. */
export function PrintLabelsButton({ tags, className, title, children }: { tags: string[]; className?: string; title?: string; children: ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const [lastUsed, setLastUsed] = useState<string | null>(null);

  useEffect(() => {
    if (!lastUsed) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLastUsed(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lastUsed]);

  const open = () => setLastUsed(document.cookie.match(new RegExp(`(?:^|; )${LABEL_FORMAT_COOKIE}=([^;]*)`))?.[1] ?? "a4");

  return (
    <>
      <button type="button" className={className} title={title} aria-label={title} onClick={open}>
        {children}
      </button>
      {lastUsed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onMouseDown={(e) => e.target === e.currentTarget && setLastUsed(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="label-format-title" className="card relative w-full max-w-md p-6 shadow-xl">
            <button type="button" className="btn absolute top-3 right-3 border-0 px-2" title={t("Close")} onClick={() => setLastUsed(null)}>
              <X className="size-4" />
            </button>
            <h2 id="label-format-title" className="text-lg font-semibold">
              {t(tags.length === 1 ? "{n} label" : "{n} labels", { n: tags.length })}
            </h2>
            <p className="mt-1 mb-5 text-sm text-dim">{t("Choose the label format to print on.")}</p>
            <div className="grid gap-2">
              {LABEL_FORMATS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  autoFocus={f.key === lastUsed}
                  className={f.key === lastUsed ? "btn btn-primary justify-center" : "btn justify-center"}
                  onClick={() => router.push(labelsHref(tags, f.key))}
                >
                  {f.key === "a4" ? t("A4 sheet") : f.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
