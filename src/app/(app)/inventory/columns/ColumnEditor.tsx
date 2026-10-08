"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { saveListColumns } from "../actions";

type Column = { key: string; label: string; custom: boolean; note?: string; original?: string };

// Renamable custom columns get their key from the (edited) label.
const toKey = (c: Column) => (c.custom ? `extra:${c.label.trim()}` : c.key);

/**
 * Edits one list's columns. Custom columns can be renamed in place; the
 * rename is applied to every item of the list when saving.
 */
export function ColumnEditor({
  departmentId,
  type,
  backHref,
  initial,
  available,
}: {
  departmentId: string;
  type: string;
  backHref: string;
  initial: Column[];
  available: Column[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [columns, setColumns] = useState<Column[]>(initial.map((c) => ({ ...c, original: c.custom ? c.label : undefined })));
  const [newName, setNewName] = useState("");

  const used = new Set(columns.map(toKey));
  const hidden = available.filter((c) => !used.has(toKey(c)));

  const move = (i: number, by: number) =>
    setColumns((cols) => {
      const next = [...cols];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });

  function addNew() {
    const label = newName.trim();
    if (!label || used.has(`extra:${label}`)) return;
    setColumns((cols) => [...cols, { key: `extra:${label}`, label, custom: true, note: "custom field" }]);
    setNewName("");
  }

  function save() {
    const renames = columns.filter((c) => c.custom && c.original && c.original !== c.label.trim()).map((c): [string, string] => [c.original!, c.label.trim()]);
    start(async () => {
      await saveListColumns(
        departmentId,
        type,
        columns.filter((c) => !c.custom || c.label.trim()).map(toKey),
        renames,
      );
      router.push(backHref);
    });
  }

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3 text-sm font-semibold">Columns shown, in order</div>
        <ul className="divide-y divide-line">
          <li className="flex items-center gap-2 px-4 py-2.5 text-sm text-dim">Tag (always first)</li>
          {columns.map((c, i) => (
            <li key={c.original ?? c.key} className="flex items-center gap-2 px-4 py-2">
              {c.custom ? (
                <input
                  value={c.label}
                  onChange={(e) => setColumns((cols) => cols.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  aria-label="Column name"
                  className="input max-w-xs"
                />
              ) : (
                <span className="flex-1 text-sm sm:max-w-xs">{c.label}</span>
              )}
              <span className="flex-1 text-xs text-dim">{c.note}</span>
              <button type="button" className="btn px-2" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">
                <ArrowUp className="size-4" />
              </button>
              <button type="button" className="btn px-2" disabled={i === columns.length - 1} onClick={() => move(i, 1)} title="Move down">
                <ArrowDown className="size-4" />
              </button>
              <button type="button" className="btn px-2" onClick={() => setColumns((cols) => cols.filter((_, j) => j !== i))} title="Hide column">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-4 p-4">
        {hidden.length > 0 && (
          <div>
            <div className="label">Add a column</div>
            <div className="flex flex-wrap gap-2">
              {hidden.map((c) => (
                <button key={toKey(c)} type="button" className="btn" onClick={() => setColumns((cols) => [...cols, c])}>
                  <Plus className="size-4" /> {c.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <div className="label">New custom column</div>
          <div className="flex max-w-md gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addNew();
                }
              }}
              placeholder="e.g. Apple ID, Toner, Room phone"
              className="input"
            />
            <button type="button" className="btn" onClick={addNew}>
              Add
            </button>
          </div>
          <p className="mt-1 text-xs text-dim">It also appears as a field on every item of this list.</p>
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Link href={backHref} className="btn">
          Cancel
        </Link>
        <button type="button" className="btn btn-primary" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save columns"}
        </button>
      </div>
    </div>
  );
}
