"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { renameList } from "./actions";

/**
 * "Rename" button of the open list; the name is edited in a popup. The popup
 * is portalled to <body> because the button sits inside the list's own form.
 */
export function RenameListButton({ departmentId, type }: { departmentId: string; type: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        <Pencil className="size-4" /> {t("Rename")}
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
            <form action={renameList} role="dialog" aria-modal="true" aria-labelledby="rename-list-title" className="card relative w-full max-w-md space-y-4 p-6 shadow-xl">
              <button type="button" className="btn absolute top-3 right-3 border-0 px-2" title={t("Close")} onClick={() => setOpen(false)}>
                <X className="size-4" />
              </button>
              <h2 id="rename-list-title" className="text-lg font-semibold">
                {t("Rename list")}
              </h2>
              <input type="hidden" name="departmentId" value={departmentId} />
              <input type="hidden" name="from" value={type} />
              <input name="type" required autoFocus defaultValue={type} onFocus={(e) => e.currentTarget.select()} aria-label={t("Name")} className="input" />
              <div className="flex justify-end gap-2">
                <button type="button" className="btn" onClick={() => setOpen(false)}>
                  {t("Cancel")}
                </button>
                <button className="btn btn-primary">{t("Save")}</button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}
