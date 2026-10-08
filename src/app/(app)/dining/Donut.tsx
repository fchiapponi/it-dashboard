"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type Slice = { id: string; name: string; color: string; value: number; note?: string };

const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");
const pct = (v: number, total: number) => `${total ? Math.round((v / total) * 100) : 0}%`;

/** Ring for part-to-whole at a glance (keep it to 6 slices or fewer), with a legend that names every slice. */
export function Donut({ slices, unit, size = 152 }: { slices: Slice[]; unit: string; size?: number }) {
  const [active, setActive] = useState<string | null>(null);
  const shown = slices.filter((s) => s.value > 0);
  const total = shown.reduce((a, s) => a + s.value, 0);
  if (!total) return <div className="px-4 py-10 text-center text-sm text-dim">No meals recorded for this selection.</div>;

  const r = size / 2,
    ring = 22,
    rm = r - ring / 2;
  const at = (f: number) => {
    const a = f * 2 * Math.PI - Math.PI / 2; // from 12 o'clock, clockwise
    return [r + rm * Math.cos(a), r + rm * Math.sin(a)];
  };
  const arcs = shown.map((s, i) => {
    const before = shown.slice(0, i).reduce((a, x) => a + x.value, 0);
    return { s, from: before / total, to: (before + s.value) / total };
  });
  const hit = shown.find((s) => s.id === active);

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 p-4">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        role="img"
        aria-label={shown.map((s) => `${s.name} ${pct(s.value, total)}`).join(", ")}
      >
        {arcs.map(({ s, from, to }) => {
          const on = !active || active === s.id;
          const common = { fill: "none", stroke: s.color, strokeWidth: active === s.id ? ring + 4 : ring, opacity: on ? 1 : 0.35 };
          const events = { onPointerEnter: () => setActive(s.id), onPointerLeave: () => setActive(null) };
          // A full ring can't be drawn as one arc.
          if (shown.length === 1) return <circle key={s.id} cx={r} cy={r} r={rm} {...common} {...events} />;
          const [x0, y0] = at(from),
            [x1, y1] = at(to);
          return (
            <path
              key={s.id}
              d={`M${x0},${y0}A${rm},${rm} 0 ${to - from > 0.5 ? 1 : 0} 1 ${x1},${y1}`}
              {...common}
              {...events}
              className="transition-[stroke-width,opacity]"
            />
          );
        })}
        {/* 2px surface gaps between slices */}
        {shown.length > 1 &&
          arcs.map(({ s, from }) => {
            const a = from * 2 * Math.PI - Math.PI / 2;
            return (
              <line
                key={s.id}
                x1={r + (r - ring - 4) * Math.cos(a)}
                y1={r + (r - ring - 4) * Math.sin(a)}
                x2={r + r * Math.cos(a)}
                y2={r + r * Math.sin(a)}
                stroke="var(--panel)"
                strokeWidth={2}
                pointerEvents="none"
              />
            );
          })}
        <text x={r} y={r - 2} textAnchor="middle" className="fill-fg text-lg font-semibold tabular-nums">
          {hit ? pct(hit.value, total) : fmt(total)}
        </text>
        <text x={r} y={r + 15} textAnchor="middle" className="fill-dim text-[11px]">
          {hit ? hit.name : unit}
        </text>
      </svg>

      <ul className="grid min-w-40 gap-1 text-sm">
        {shown.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onPointerEnter={() => setActive(s.id)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(s.id)}
              onBlur={() => setActive(null)}
              className={cn(
                "grid w-full grid-cols-[10px_1fr_auto_auto] items-center gap-2 rounded px-1 py-0.5 text-left",
                active === s.id && "bg-panel-muted",
              )}
              title={s.note}
            >
              <i className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
              <span className="text-dim">{s.name}</span>
              <span className="tabular-nums">{fmt(s.value)}</span>
              <span className="w-9 text-right text-dim tabular-nums">{pct(s.value, total)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
