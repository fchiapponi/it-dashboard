"use client";

import { useEffect } from "react";
import { LABEL_FORMAT_COOKIE } from "./format";

/**
 * Remembers the label format shown, so the next print (e.g. the printer icon on
 * an inventory row) uses it again, and opens the print dialog when `print` is set.
 */
export function LabelPrint({ format, print }: { format: string; print: boolean }) {
  useEffect(() => {
    document.cookie = `${LABEL_FORMAT_COOKIE}=${format}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, [format]);

  useEffect(() => {
    if (print) window.print();
  }, [print]);

  return null;
}
