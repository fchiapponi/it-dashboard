"use client";

import type { ReactNode } from "react";

/** Submit button that asks for confirmation before its form's action runs. */
export function ConfirmButton({ message, className, title, children }: { message: string; className?: string; title?: string; children: ReactNode }) {
  return (
    <button
      className={className}
      title={title}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
