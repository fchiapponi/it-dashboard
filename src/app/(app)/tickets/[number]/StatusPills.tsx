"use client";

import { cn } from "@/lib/utils";

/** Status choices as colored pills; picking one submits the surrounding form right away. */
export function StatusPills({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string; className: string }[];
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap opacity-55 ring-current transition hover:opacity-100 has-checked:opacity-100 has-checked:ring-2 has-focus-visible:ring-2",
            o.className,
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={o.value === defaultValue}
            className="sr-only"
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
