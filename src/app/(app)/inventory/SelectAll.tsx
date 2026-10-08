"use client";

/** Header checkbox that ticks every row checkbox (name="tag") in its form. */
export function SelectAll() {
  return (
    <input
      type="checkbox"
      aria-label="Select all"
      onChange={(e) => {
        for (const box of e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="tag"]') ?? []) box.checked = e.currentTarget.checked;
      }}
    />
  );
}
