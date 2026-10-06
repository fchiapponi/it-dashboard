"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button className="btn btn-primary" onClick={() => window.print()}>
      <Printer className="size-4" /> Print
    </button>
  );
}
