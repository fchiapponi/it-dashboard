"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DAY_KINDS, type CalendarDay } from "@/lib/schoolCalendar";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Series = { id: string; name: string; color: string };

export type Bucket = {
  key: string;
  label: string;
  /** false hides this bucket's x label; undefined lets the chart thin labels to fit */
  tick?: boolean;
  title: string;
  parts: Record<string, number | null>;
  total: number | null;
  event?: string;
  cal?: CalendarDay;
};

const fmt = (n: number | null | undefined) => (n == null ? "–" : Math.round(n).toLocaleString("en-GB"));

function niceMax(v: number) {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const topRounded = (x: number, y: number, w: number, h: number, r: number) => {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

/** Bars stacked by series, one per bucket, with a hover/keyboard tooltip listing every series. */
export function StackedBars({
  buckets,
  series,
  height = 260,
  showTotals = false,
  showEvents = false,
  showCalendar = false,
  minStep = 0,
  startAtEnd = true,
}: {
  buckets: Bucket[];
  series: Series[];
  height?: number;
  showTotals?: boolean;
  showEvents?: boolean;
  showCalendar?: boolean;
  /** Narrowest a bar's slot may get, in px; past that the chart scrolls sideways instead of squeezing the bars */
  minStep?: number;
  /** A scrolling chart opens on its last bars (latest dates); false opens on the first */
  startAtEnd?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<{
    i: number;
    x: number;
    y: number;
  } | null>(null);

  const empty = !buckets.length || buckets.every((b) => !b.total);
  const m = {
    t: showEvents || showTotals ? 18 : 8,
    r: 4,
    b: showCalendar ? 36 : 24,
    l: 44,
  };
  // CSS sizes the chart (the card's width, or wider when the bars need it), so it
  // fills the card and scrolls even where measuring fails. The measured width only
  // makes the drawing exact; until then it is stretched to fit.
  const minW = Math.ceil(m.l + m.r + buckets.length * minStep);
  const W = width || Math.max(800, minW),
    H = height;

  // Measures the chart's own box, straight away and on every resize.
  const box = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    setWidth(Math.floor(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Which way there is still something to scroll to, for the ‹ › buttons and the fixed axis.
  const [edges, setEdges] = useState({ left: false, right: false });
  const onScroll = () => {
    const el = scroller.current;
    if (el) setEdges({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  };
  const scrolls = edges.left || edges.right;

  // A chart wider than its card opens on its latest bars.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = startAtEnd ? el.scrollWidth : 0;
    onScroll();
  }, [minW, buckets.length, startAtEnd]);
  useEffect(onScroll, [width]);
  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    el?.scrollBy({ left: dir * (el.clientWidth - m.l) * 0.8, behavior: "smooth" });
  };

  if (empty) {
    return <div className="px-4 py-10 text-center text-sm text-dim">No meals recorded for this selection.</div>;
  }

  // Labels that must all show but are wider than their bar go on two staggered rows.
  const textW = (t: string) => t.length * 6.3; // 11px text, roughly
  // (Only charts labelling every bar: the daily chart's month labels already have room.)
  const stagger = buckets.every((b) => b.tick) && buckets.some((b) => textW(b.label) + 8 > (W - m.l - m.r) / buckets.length);
  if (stagger) m.b += 14;
  const iw = W - m.l - m.r,
    ih = H - m.t - m.b;
  const max = niceMax(Math.max(...buckets.map((b) => b.total ?? 0)));
  const y = (v: number) => m.t + ih - (v / max) * ih;
  const step = iw / buckets.length;
  const gap = step >= 8 ? Math.min(step * 0.28, 14) : step >= 4 ? 1 : 0;
  const bw = Math.min(64, Math.max(1, step - gap)); // a few buckets still get bars, not slabs
  const labelEvery = Math.max(1, Math.ceil(46 / step));

  const pick = (clientX: number, clientY: number, rect: DOMRect) => {
    const sx = (clientX - rect.left) * (W / rect.width);
    const i = Math.floor((sx - m.l) / step);
    if (i >= 0 && i < buckets.length) setHover({ i, x: clientX - rect.left, y: clientY - rect.top });
    else setHover(null);
  };
  const onKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const cur = hover?.i ?? buckets.length;
    const i = Math.max(0, Math.min(buckets.length - 1, cur + (e.key === "ArrowRight" ? 1 : -1)));
    const scale = e.currentTarget.getBoundingClientRect().width / W;
    setHover({ i, x: (m.l + i * step + step / 2) * scale, y: 20 });
  };

  const tipLeft = hover ? (hover.x + 14 + 230 > W ? Math.max(0, hover.x - 230 - 14) : hover.x + 14) : 0;
  const hb = hover ? buckets[hover.i] : null;

  return (
    <div className="relative w-full">
      {/* macOS hides scroll bars and a mouse wheel can't scroll sideways: scroll-x-visible keeps the bar on screen. */}
      <div ref={scroller} onScroll={onScroll} className={cn("scroll-x-visible overflow-x-auto", scrolls && "pb-1")}>
        <div ref={box} className="relative" style={{ width: `max(100%, ${minW}px)` }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio={width ? undefined : "none"}
            height={H}
            className="block w-full overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            tabIndex={0}
            role="img"
            aria-label="Bar chart. Use the left and right arrow keys to read each bar."
            onPointerMove={(e) => pick(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())}
            onPointerLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
            onKeyDown={onKey}
          >
            {[0, 1, 2, 3, 4].map((i) => {
              const v = (max / 4) * i;
              return (
                <g key={i}>
                  <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke={i === 0 ? "var(--text-dim)" : "var(--border)"} strokeWidth={1} />
                  <text x={m.l - 8} y={y(v) + 4} textAnchor="end" className="fill-dim text-[11px] tabular-nums">
                    {fmt(v)}
                  </text>
                </g>
              );
            })}
            {hover && <rect x={m.l + hover.i * step} y={m.t} width={step} height={ih} fill="var(--text)" opacity={0.05} />}
            {buckets.map((b, i) => {
              const x = m.l + i * step + (step - bw) / 2;
              const parts = series.map((s) => ({ s, v: b.parts[s.id] ?? 0 })).filter((p) => p.v > 0);
              let acc = 0;
              return (
                <g key={b.key} opacity={hover && hover.i !== i ? 0.55 : 1}>
                  {parts.map((p, j) => {
                    const y0 = y(acc),
                      y1 = y(acc + p.v);
                    acc += p.v;
                    const top = j === parts.length - 1;
                    const sep = parts.length > 1 && !top && bw >= 4 ? 1 : 0; // surface gap between segments
                    const h = Math.max(0, y0 - y1 - sep);
                    return top && bw >= 4 ? (
                      <path key={p.s.id} d={topRounded(x, y1, bw, h, Math.min(4, bw / 3))} fill={p.s.color} />
                    ) : (
                      <rect key={p.s.id} x={x} y={y1} width={bw} height={h} fill={p.s.color} />
                    );
                  })}
                  {showEvents && b.event && <circle cx={x + bw / 2} cy={7} r={Math.min(3.5, Math.max(2, bw / 2))} fill="var(--dining-event)" />}
                  {showTotals && !!b.total && textW(fmt(b.total)) + 4 <= step && (
                    <text x={x + bw / 2} y={y(b.total) - 5} textAnchor="middle" className="fill-fg text-[11px] tabular-nums">
                      {fmt(b.total)}
                    </text>
                  )}
                  {showCalendar && b.cal?.kind && (
                    <rect
                      x={m.l + i * step}
                      y={m.t + ih + 4}
                      width={Math.max(1, step + (step < 4 ? 0.5 : -1))}
                      height={7}
                      rx={step >= 6 ? 2 : 0}
                      fill={DAY_KINDS[b.cal.kind].color}
                    />
                  )}
                  {(b.tick ?? i % labelEvery === 0) && (
                    <text
                      x={m.l + i * step + step / 2}
                      y={stagger && i % 2 === 0 ? H - 20 : H - 6}
                      textAnchor="middle"
                      className="fill-dim text-[11px]"
                    >
                      {b.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {hb && hover && (
            <div
              className="pointer-events-none absolute z-10 grid w-[230px] gap-1 rounded-lg border border-line bg-panel p-3 text-xs shadow-lg"
              style={{ left: tipLeft, top: Math.max(0, hover.y - 10) }}
            >
              <div className="font-medium text-dim">{hb.title}</div>
              {series.map((s) => (
                <div key={s.id} className="grid grid-cols-[14px_1fr_auto] items-center gap-2">
                  <i className="h-[3px] rounded-sm" style={{ background: s.color }} />
                  <span className="text-dim">{s.name}</span>
                  <b className="text-right tabular-nums">{fmt(hb.parts[s.id])}</b>
                </div>
              ))}
              {series.length > 1 && (
                <div className="flex justify-between border-t border-line pt-1">
                  <span className="text-dim">Total</span>
                  <b className="tabular-nums">{fmt(hb.total)}</b>
                </div>
              )}
              {hb.event && <div className="font-semibold text-[var(--dining-event)]">{hb.event}</div>}
              {hb.cal?.kind && (
                <div className="mt-0.5 flex items-center gap-1.5 border-t border-line pt-1 font-medium">
                  <i className="h-1.5 w-3.5 shrink-0 rounded-sm" style={{ background: DAY_KINDS[hb.cal.kind].color }} />
                  {DAY_KINDS[hb.cal.kind].name}
                </div>
              )}
              {hb.cal?.notes.map((n) => (
                <div key={n} className="text-dim">
                  {n}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* The y axis stays put while the bars scroll under it. */}
      {scrolls && (
        <svg width={m.l} height={H} className="pointer-events-none absolute top-0 left-0">
          <rect width={m.l} height={H} fill="var(--panel)" />
          {[0, 1, 2, 3, 4].map((i) => (
            <text key={i} x={m.l - 8} y={y((max / 4) * i) + 4} textAnchor="end" className="fill-dim text-[11px] tabular-nums">
              {fmt((max / 4) * i)}
            </text>
          ))}
        </svg>
      )}
      {scrolls && (
        <>
          <ScrollButton side="left" style={{ left: m.l + 4 }} disabled={!edges.left} onClick={() => scrollBy(-1)} />
          <ScrollButton side="right" style={{ right: 4 }} disabled={!edges.right} onClick={() => scrollBy(1)} />
        </>
      )}
    </div>
  );
}

function ScrollButton({
  side,
  style,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  style: React.CSSProperties;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Earlier days" : "Later days"}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className="absolute top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-line bg-panel text-dim shadow-sm transition hover:text-fg disabled:pointer-events-none disabled:opacity-0"
    >
      <Icon className="size-4" />
    </button>
  );
}
