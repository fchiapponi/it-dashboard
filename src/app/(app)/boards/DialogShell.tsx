"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useI18n } from "@/i18n/client";

/** Modal overlay that navigates to `closeHref` on Escape, backdrop click or the close button. */
export function DialogShell({ closeHref, children }: { closeHref: string; children: ReactNode }) {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(closeHref, { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeHref, router]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) router.push(closeHref, { scroll: false });
      }}
    >
      <div role="dialog" aria-modal="true" className="card relative w-full max-w-2xl shadow-xl">
        <button
          className="btn absolute top-3 right-3 border-0 px-2"
          title={t("Close")}
          onClick={() => router.push(closeHref, { scroll: false })}
        >
          <X className="size-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
