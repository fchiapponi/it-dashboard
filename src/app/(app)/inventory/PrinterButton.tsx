"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Runs a printer read action and shows its outcome next to the button. */
export function PrinterButton({ action, children }: { action: () => Promise<{ ok: boolean; message: string }>; children: React.ReactNode }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" className="btn" disabled={pending} onClick={() => start(async () => setResult(await action()))}>
        <RefreshCw className={cn("size-4", pending && "animate-spin")} /> {pending ? "Reading…" : children}
      </button>
      {result && !pending && (
        <span className={cn("text-xs", result.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400")}>{result.message}</span>
      )}
    </span>
  );
}
