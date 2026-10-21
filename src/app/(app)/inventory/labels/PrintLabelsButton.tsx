"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { LABEL_FORMAT_COOKIE, LABEL_FORMATS, labelsHref } from "./format";

/**
 * Asks for the label format in a popup, then opens the labels page and its
 * print dialog. Prints `tags`, or without them the rows ticked in its form.
 */
export function PrintLabelsButton({
  tags,
  className,
  title,
  children,
}: {
  tags?: string[];
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const button = useRef<HTMLButtonElement>(null);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [lastUsed, setLastUsed] = useState("a4");

  useEffect(() => {
    if (!chosen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setChosen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chosen]);

  const open = () => {
    const ticked = [
      ...(button.current?.form?.querySelectorAll<HTMLInputElement>(
        'input[name="tag"]:checked',
      ) ?? []),
    ].map((box) => box.value);
    setLastUsed(
      document.cookie.match(
        new RegExp(`(?:^|; )${LABEL_FORMAT_COOKIE}=([^;]*)`),
      )?.[1] ?? "a4",
    );
    setChosen(tags ?? ticked);
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className={className}
        title={title}
        aria-label={title}
        onClick={open}
      >
        {children}
      </button>
      {chosen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onMouseDown={(e) => e.target === e.currentTarget && setChosen(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="label-format-title"
            className="card relative w-full max-w-md p-6 shadow-xl"
          >
            <button
              type="button"
              className="btn absolute top-3 right-3 border-0 px-2"
              title={t("Close")}
              onClick={() => setChosen(null)}
            >
              <X className="size-4" />
            </button>
            <h2 id="label-format-title" className="text-lg font-semibold">
              {t(chosen.length === 1 ? "{n} label" : "{n} labels", {
                n: chosen.length,
              })}
            </h2>
            {chosen.length === 0 ? (
              <p className="mt-2 text-sm text-dim">
                {t("Select assets in the inventory list first.")}
              </p>
            ) : (
              <>
                <p className="mt-1 mb-5 text-sm text-dim">
                  {t("Choose the label format to print on.")}
                </p>
                <div className="grid gap-2">
                  {LABEL_FORMATS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      autoFocus={f.key === lastUsed}
                      className={
                        f.key === lastUsed
                          ? "btn btn-primary justify-center"
                          : "btn justify-center"
                      }
                      onClick={() => router.push(labelsHref(chosen, f.key))}
                    >
                      {f.key === "a4" ? t("A4 sheet") : f.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
