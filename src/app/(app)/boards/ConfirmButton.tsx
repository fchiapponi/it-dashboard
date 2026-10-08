"use client";

import type { ReactNode } from "react";

/** Submit button that asks for confirmation before its form's action runs. */
export function ConfirmButton({
  message,
  className,
  title,
  formAction,
  children,
}: {
  message: string;
  className?: string;
  title?: string;
  formAction?: (form: FormData) => void | Promise<void>;
  children: ReactNode;
}) {
  return (
    <button
      className={className}
      formAction={formAction}
      title={title}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
