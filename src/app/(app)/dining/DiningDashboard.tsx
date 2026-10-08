"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DiningDay } from "@/lib/dining";
import { calendarDay, DAY_KINDS, dayKey, parseDay, weekday, type CalendarDay, type DayKind } from "@/lib/schoolCalendar";
import { Section, TableWrap } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Donut, type Slice } from "./Donut";
import { StackedBars, type Bucket, type Series } from "./StackedBars";

type HallId = "dn" | "had" | "foc";
type Meal = "breakfast" | "lunch" | "dinner";
type DayFilter = "all" | "weekdays" | "weekends" | "brunch";

const HALLS: (Series & { id: HallId })[] = [
  { id: "dn", name: "De Nobili", color: "var(--hall-1)" },
  { id: "had", name: "Hadsall", color: "var(--hall-2)" },
  { id: "foc", name: "Focolare", color: "var(--hall-3)" },
];
const MEALS: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
const DAY_FILTERS: Record<DayFilter, string> = { all: "All", weekdays: "Weekdays", weekends: "Weekends", brunch: "Brunch" };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_NAMES = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"];

/** How often an open page asks the server for the latest read of the sheet. */
const POLL_MS = 5 * 60_000;

/** Breakfast → dinner as one hue, light → dark: they are in order through the day. */
const MEAL_COLORS: Record<Meal, string> = { breakfast: "var(--meal-1)", lunch: "var(--meal-2)", dinner: "var(--meal-3)" };

const ALL_KINDS = Object.keys(DAY_KINDS) as DayKind[];
/** One-click choices in the school calendar picker. */
const KIND_PRESETS: { label: string; kinds: DayKind[] }[] = [
  { label: "Every kind of day", kinds: ALL_KINDS },
  { label: "Without holidays", kinds: ALL_KINDS.filter((k) => k !== "holiday") },
  { label: "School in session", kinds: ["classes", "weekend", "special", "orientation"] },
];

type Day = DiningDay & { d: Date; wd: number; cal: CalendarDay };

const fmt = (n: number | null | undefined) => (n == null ? "–" : Math.round(n).toLocaleString("en-GB"));
const fmtDay = (d: Date, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) => d.toLocaleDateString("en-GB", o);
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const isBrunch = (tag: string) => tag.includes("BRUNCH");

function hallMeal(day: DiningDay, hall: HallId, meal: Meal): number | null {
  if (hall === "dn") return day.dn[meal];
  return meal === "breakfast" ? null : day[hall][meal];
}

export function DiningDashboard({ days: raw }: { days: DiningDay[] }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [router]);

  const days = useMemo<Day[]>(
    () =>
      raw.map((r) => {
        const d = parseDay(r.date);
        return { ...r, d, wd: weekday(d), cal: calendarDay(r.date) };
      }),
    [raw],
  );
  const lastDate = days.length ? days[days.length - 1].d : new Date();

  // ------------------------------------------------------------- filters
  const periods = useMemo(() => {
    const years = [...new Set(days.map((d) => d.d.getFullYear()))].sort((a, b) => b - a);
    const list: { key: string; label: string; from: Date; to: Date }[] = [];
    for (const y of years) list.push({ key: `y${y}`, label: `All of ${y}`, from: new Date(y, 0, 1), to: new Date(y, 11, 31) });
    for (const n of [30, 90]) {
      const from = new Date(lastDate);
      from.setDate(from.getDate() - n + 1);
      list.push({ key: `last${n}`, label: `Last ${n} days`, from, to: lastDate });
    }
    if (days.length) {
      // Every month from the first recorded one to the last.
      const end = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);
      for (let m = new Date(days[0].d.getFullYear(), days[0].d.getMonth(), 1); m <= end; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
        list.push({
          key: `m${m.getFullYear()}-${m.getMonth()}`,
          label: fmtDay(m, { month: "long", year: "numeric" }),
          from: m,
          to: new Date(m.getFullYear(), m.getMonth() + 1, 0),
        });
      }
    }
    return list;
    // lastDate is derived from days
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const [periodKey, setPeriodKey] = useState(() => periods[0]?.key ?? "");
  const [kinds, setKinds] = useState<DayKind[]>(ALL_KINDS);
  const allKinds = kinds.length === ALL_KINDS.length;
  const [dayFilter, setDayFilter] = useState<DayFilter>("all");
  const [meal, setMeal] = useState<Meal | "all">("all");
  const [hallIds, setHallIds] = useState<HallId[]>(["dn", "had", "foc"]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "date", dir: -1 });

  // Custom range: starts as the last 30 days of data, either end can be typed in any order.
  const [custom, setCustom] = useState(() => {
    const from = new Date(lastDate);
    from.setDate(from.getDate() - 29);
    return { from: dayKey(from), to: dayKey(lastDate) };
  });
  const customPeriod = (() => {
    const [a, b] = [custom.from, custom.to].filter(Boolean).sort();
    if (!a) return null;
    const from = parseDay(a),
      to = parseDay(b ?? a);
    return {
      key: "custom",
      label: `${fmtDay(from, { day: "numeric", month: "short", year: "numeric" })} – ${fmtDay(to, { day: "numeric", month: "short", year: "numeric" })}`,
      from,
      to,
    };
  })();
  const period = periodKey === "custom" && customPeriod ? customPeriod : (periods.find((p) => p.key === periodKey) ?? periods[0]);
  const halls = HALLS.filter((h) => hallIds.includes(h.id));
  const meals: Meal[] = meal === "all" ? ["breakfast", "lunch", "dinner"] : [meal];
  const mealWord = meal === "all" ? "meals" : MEALS[meal].toLowerCase();

  const passes = (d: { wd: number; tag: string; kind: DayKind | null }) =>
    !(dayFilter === "weekdays" && d.wd >= 5) &&
    !(dayFilter === "weekends" && d.wd < 5) &&
    !(dayFilter === "brunch" && !isBrunch(d.tag)) &&
    // Days past the calendar's end have no kind: they only show with every kind ticked.
    (allKinds || (!!d.kind && kinds.includes(d.kind)));

  const selected = period ? days.filter((d) => d.d >= period.from && d.d <= period.to && passes({ ...d, kind: d.cal.kind })) : [];

  const hallVal = (d: DiningDay, h: HallId) => {
    let s: number | null = null;
    for (const m of meals) {
      const v = hallMeal(d, h, m);
      if (v != null) s = (s ?? 0) + v;
    }
    return s;
  };
  const dayTotal = (d: DiningDay) => {
    let s: number | null = null;
    for (const h of halls) {
      const v = hallVal(d, h.id);
      if (v != null) s = (s ?? 0) + v;
    }
    return s;
  };
  const bucket = (group: DiningDay[], extra: Omit<Bucket, "parts" | "total">): Bucket => {
    const parts: Record<string, number | null> = {};
    let total: number | null = null;
    for (const h of halls) {
      let s: number | null = null;
      for (const d of group) {
        const v = hallVal(d, h.id);
        if (v != null) s = (s ?? 0) + v;
      }
      parts[h.id] = s;
      if (s != null) total = (total ?? 0) + s;
    }
    return { ...extra, parts, total };
  };
  /**
   * Average over the days with any service, a hall that was closed counting as 0,
   * so the halls add up to the average day's total.
   */
  const average = (group: DiningDay[], extra: Omit<Bucket, "parts" | "total">): Bucket => {
    const open = group.filter((d) => dayTotal(d));
    const parts: Record<string, number | null> = {};
    let total: number | null = null;
    for (const h of halls) {
      const s = open.reduce((a, d) => a + (hallVal(d, h.id) ?? 0), 0);
      parts[h.id] = s ? s / open.length : null;
      if (s) total = (total ?? 0) + s / open.length;
    }
    return { ...extra, parts, total };
  };

  // ------------------------------------------------------------- summary
  const served = selected.map((d) => ({ d, t: dayTotal(d) })).filter((x): x is { d: Day; t: number } => !!x.t);
  const sum = served.reduce((a, x) => a + x.t, 0);
  const peak = served.reduce<(typeof served)[number] | null>((a, x) => (!a || x.t > a.t ? x : a), null);
  const weekdaysServed = served.filter((x) => x.d.wd < 5);
  const perMeal = (["breakfast", "lunch", "dinner"] as Meal[]).map((m) => ({
    m,
    s: selected.reduce((a, d) => a + halls.reduce((b, h) => b + (hallMeal(d, h.id, m) ?? 0), 0), 0),
  }));

  // -------------------------------------------------------------- charts
  const months = new Set(selected.map((d) => `${d.d.getFullYear()}-${d.d.getMonth()}`));
  const longRange = months.size > 1 && selected.length > 70;
  const daily = selected.map((d, i) => {
    const newMonth = i === 0 || d.d.getMonth() !== selected[i - 1].d.getMonth();
    return bucket([d], {
      key: d.date,
      label: longRange ? fmtDay(d.d, { month: "short" }) : String(d.d.getDate()),
      tick: longRange ? newMonth : undefined,
      title: fmtDay(d.d, { weekday: "short", day: "numeric", month: "long" }),
      event: d.tag ? titleCase(d.tag) : undefined,
      cal: d.cal,
    });
  });

  let trendTitle: string,
    trendNote = "";
  let trend: Bucket[];
  if (months.size > 1) {
    trendTitle = "Total per month";
    const by = new Map<string, Day[]>();
    for (const d of selected) {
      const k = `${d.d.getFullYear()}-${String(d.d.getMonth()).padStart(2, "0")}`;
      by.set(k, [...(by.get(k) ?? []), d]);
    }
    trend = [...by].map(([k, group]) =>
      bucket(group, {
        key: k,
        label: fmtDay(group[0].d, { month: "short" }),
        tick: true,
        title: fmtDay(group[0].d, { month: "long", year: "numeric" }),
      }),
    );
    const last = selected[selected.length - 1];
    if (
      last &&
      last.d.getTime() === lastDate.getTime() &&
      new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 0).getDate() !== lastDate.getDate()
    ) {
      trendNote = `${fmtDay(lastDate, { month: "long" })} so far`;
    }
  } else {
    trendTitle = "Total per week";
    trendNote = "Mon–Sun weeks";
    const by = new Map<string, { start: Date; group: Day[] }>();
    for (const d of selected) {
      const start = new Date(d.d);
      start.setDate(start.getDate() - d.wd);
      const k = dayKey(start);
      if (!by.has(k)) by.set(k, { start, group: [] });
      by.get(k)!.group.push(d);
    }
    trend = [...by].map(([k, { start, group }]) => {
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return bucket(group, { key: k, label: fmtDay(start), tick: true, title: `Week ${fmtDay(start)} – ${fmtDay(end)}` });
    });
  }

  const shownWeekdays = [0, 1, 2, 3, 4, 5, 6].filter((i) =>
    dayFilter === "weekdays" ? i < 5 : dayFilter === "all" && allKinds ? true : selected.some((d) => d.wd === i),
  );
  const byWeekday = shownWeekdays.map((i) =>
    average(
      selected.filter((d) => d.wd === i),
      { key: String(i), label: WEEKDAYS[i], tick: true, title: `Average on ${WEEKDAY_NAMES[i]}` },
    ),
  );

  const kindsPresent = new Set(selected.map((d) => d.cal.kind).filter(Boolean) as DayKind[]);
  const byKind = (Object.keys(DAY_KINDS) as DayKind[])
    .filter((k) => kindsPresent.has(k))
    .map((k) => {
      const group = selected.filter((d) => d.cal.kind === k);
      const n = group.filter((d) => dayTotal(d)).length;
      return average(group, { key: k, label: DAY_KINDS[k].short, tick: true, title: `${DAY_KINDS[k].name} · average of ${n} days` });
    });

  // -------------------------------------------------------------- donuts
  const hallSlices: Slice[] = halls.map((h) => ({
    id: h.id,
    name: h.name,
    color: h.color,
    value: selected.reduce((a, d) => a + (hallVal(d, h.id) ?? 0), 0),
  }));
  const mealSlices: Slice[] = perMeal.map((p) => ({ id: p.m, name: MEALS[p.m], color: MEAL_COLORS[p.m], value: p.s }));
  const kindSlices: Slice[] = (Object.keys(DAY_KINDS) as DayKind[]).map((k) => {
    const group = served.filter((x) => x.d.cal.kind === k);
    return {
      id: k,
      name: DAY_KINDS[k].name,
      color: DAY_KINDS[k].color,
      value: group.reduce((a, x) => a + x.t, 0),
      note: `${group.length} days with service`,
    };
  });

  // ----------------------------------------------------------- daily log
  type Col = { key: string; label: string; group?: string; left?: boolean; total?: boolean };
  const cols: Col[] = [
    { key: "date", label: "Date", left: true },
    { key: "kind", label: "Day", group: "Calendar", left: true },
  ];
  for (const m of meals) {
    const servingHalls = halls.filter((h) => h.id === "dn" || m !== "breakfast"); // breakfast is De Nobili only
    for (const h of servingHalls) cols.push({ key: `${h.id}.${m}`, label: h.name, group: MEALS[m] });
    if (servingHalls.length > 1) cols.push({ key: `total.${m}`, label: "Total", group: MEALS[m], total: true });
  }
  cols.push({ key: "tag", label: "Kitchen note", left: true }, { key: "notes", label: "Calendar notes", group: "Calendar", left: true });

  const cell = (d: Day, key: string): string | number | null => {
    if (key === "date") return d.date;
    if (key === "kind") return d.cal.kind ? DAY_KINDS[d.cal.kind].name : "";
    if (key === "tag") return d.tag;
    if (key === "notes") return d.cal.notes.join(" · ");
    const [h, m] = key.split(".") as [HallId | "total", Meal];
    if (h === "total") {
      let s: number | null = null;
      for (const x of halls) {
        const v = hallMeal(d, x.id, m);
        if (v != null) s = (s ?? 0) + v;
      }
      return s;
    }
    return hallMeal(d, h, m);
  };
  const q = query.trim().toLowerCase();
  const logRows = selected
    .filter(
      (d) =>
        !q ||
        d.date.includes(q) ||
        d.tag.toLowerCase().includes(q) ||
        d.cal.notes.join(" ").toLowerCase().includes(q) ||
        (d.cal.kind && DAY_KINDS[d.cal.kind].name.toLowerCase().includes(q)) ||
        fmtDay(d.d, { weekday: "long", day: "numeric", month: "long" }).toLowerCase().includes(q),
    )
    .sort((a, b) => {
      const x = cell(a, sort.key),
        y = cell(b, sort.key);
      if (x == null || x === "") return 1;
      if (y == null || y === "") return -1;
      return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
    });

  const toggleHall = (id: HallId) => setHallIds((ids) => (ids.includes(id) ? (ids.length > 1 ? ids.filter((x) => x !== id) : ids) : [...ids, id]));

  return (
    <div className="space-y-6" data-wide>
      {/* Filters scope everything below them. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="flex items-center gap-2">
          <span className="text-xs font-medium text-dim">Period</span>
          <select
            className="input w-auto py-1.5"
            value={periodKey === "custom" ? "custom" : period?.key}
            onChange={(e) => setPeriodKey(e.target.value)}
          >
            {periods.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom range…</option>
          </select>
        </label>
        {periodKey === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="From"
              className="input w-auto py-1.5"
              value={custom.from}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            />
            <span className="text-xs text-dim">to</span>
            <input
              type="date"
              aria-label="To"
              className="input w-auto py-1.5"
              value={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            />
          </div>
        )}
        <KindPicker value={kinds} onChange={setKinds} />
        <Segmented label="Days" value={dayFilter} options={DAY_FILTERS} onChange={setDayFilter} />
        <Segmented label="Meal" value={meal} options={{ all: "All", ...MEALS }} onChange={setMeal} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-dim">Dining hall</span>
          {HALLS.map((h) => {
            const on = hallIds.includes(h.id);
            return (
              <button
                key={h.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleHall(h.id)}
                className={cn("inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-sm", !on && "text-dim")}
              >
                <i
                  className={cn("size-2.5 rounded-[3px]", !on && "outline outline-1 -outline-offset-1 outline-current")}
                  style={on ? { background: h.color } : undefined}
                />
                {h.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label={meal === "all" ? "Meals served" : `${MEALS[meal]}s served`}
          value={fmt(sum)}
          note={
            meal === "all"
              ? perMeal
                  .filter((p) => p.s)
                  .map((p) => `${MEALS[p.m]} ${fmt(p.s)}`)
                  .join(" · ")
              : `${served.length} days with service`
          }
        />
        {dayFilter === "all" && allKinds ? (
          <Tile
            label="Average weekday"
            value={fmt(weekdaysServed.length ? weekdaysServed.reduce((a, x) => a + x.t, 0) / weekdaysServed.length : null)}
            note={`Mon–Fri, ${weekdaysServed.length} days · all days ${fmt(served.length ? sum / served.length : null)}`}
          />
        ) : (
          <Tile label="Average per day" value={fmt(served.length ? sum / served.length : null)} note={`${served.length} days with service`} />
        )}
        <Tile
          label="Busiest day"
          value={peak ? fmt(peak.t) : "–"}
          note={
            peak ? `${fmtDay(peak.d.d, { weekday: "long", day: "numeric", month: "long" })}${peak.d.tag ? ` · ${peak.d.tag.toLowerCase()}` : ""}` : ""
          }
        />
        {dayFilter === "brunch" ? (
          <Tile
            label="Brunches"
            value={String(served.length)}
            note={`${served.filter((x) => x.d.wd === 5).length} on Saturday · ${served.filter((x) => x.d.wd === 6).length} on Sunday`}
          />
        ) : (
          <Tile label="Days with a kitchen note" value={String(selected.filter((d) => d.tag).length)} note="Brunch, BBQ, special dinners, openings" />
        )}
      </div>

      <Section
        title={`${meal === "all" ? "Meals" : MEALS[meal]} per day`}
        actions={
          <Legend>
            {halls.map((h) => (
              <LegendItem key={h.id} color={h.color} label={h.name} />
            ))}
            <span className="inline-flex items-center gap-1.5">
              <i className="size-[7px] rounded-full bg-[var(--dining-event)]" /> Kitchen note
            </span>
          </Legend>
        }
      >
        <div className="space-y-3 p-4">
          <StackedBars buckets={daily} series={halls} height={440} minStep={9} showEvents showCalendar />
          <Legend>
            <span className="text-[11px] font-semibold tracking-wide text-dim uppercase">School calendar</span>
            {(Object.keys(DAY_KINDS) as DayKind[])
              .filter((k) => kindsPresent.has(k))
              .map((k) => (
                <LegendItem key={k} color={DAY_KINDS[k].color} label={DAY_KINDS[k].name} wide />
              ))}
          </Legend>
        </div>
      </Section>

      <div className="grid gap-6 md:grid-cols-3">
        <Section title="Share by dining hall" actions={<span className="text-xs text-dim">{mealWord}</span>}>
          {halls.length > 1 ? (
            <Donut slices={hallSlices} unit={mealWord} />
          ) : (
            <div className="px-4 py-10 text-center text-sm text-dim">Pick more than one dining hall to compare them.</div>
          )}
        </Section>
        <Section
          title="Share by meal"
          actions={<span className="text-xs text-dim">{halls.length === 3 ? "all halls" : halls.map((h) => h.name).join(" + ")}</span>}
        >
          {meal === "all" ? (
            <Donut slices={mealSlices} unit="meals" />
          ) : (
            <div className="px-4 py-10 text-center text-sm text-dim">Set Meal to All to see the split.</div>
          )}
        </Section>
        <Section title="Share by kind of day" actions={<span className="text-xs text-dim">{mealWord}, from the school calendar</span>}>
          <Donut slices={kindSlices} unit={mealWord} />
        </Section>
      </div>

      <Section title={trendTitle} actions={<span className="text-xs text-dim">{trendNote}</span>}>
        <div className="p-4">
          <StackedBars buckets={trend} series={halls} height={280} minStep={56} showTotals />
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Average by weekday" actions={<span className="text-xs text-dim">days with service</span>}>
          <div className="p-4">
            <StackedBars buckets={byWeekday} series={halls} height={240} minStep={52} startAtEnd={false} showTotals />
          </div>
        </Section>
        <Section title="Average by kind of day" actions={<span className="text-xs text-dim">from the school calendar</span>}>
          <div className="p-4">
            <StackedBars buckets={byKind} series={halls} height={240} minStep={64} startAtEnd={false} showTotals />
          </div>
        </Section>
      </div>

      <Section
        title="Daily log"
        actions={
          <input
            type="search"
            className="input w-56 py-1.5"
            placeholder="Search date, note, holiday…"
            aria-label="Search the daily log"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        }
      >
        <div className="max-h-[520px] overflow-y-auto">
          <TableWrap>
            <table className="table">
              <thead className="sticky top-0 bg-panel">
                <tr>
                  {cols.map((c) => (
                    <th
                      key={c.key}
                      className={cn("cursor-pointer whitespace-nowrap select-none", c.left ? "text-left" : "text-right")}
                      aria-sort={sort.key === c.key ? (sort.dir > 0 ? "ascending" : "descending") : "none"}
                      tabIndex={0}
                      onClick={() =>
                        setSort((s) => (s.key === c.key ? { key: c.key, dir: s.dir > 0 ? -1 : 1 } : { key: c.key, dir: c.left ? 1 : -1 }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          (e.currentTarget as HTMLElement).click();
                        }
                      }}
                    >
                      <span className="block text-[10px] opacity-70">{c.group ?? " "}</span>
                      {c.label}
                      {sort.key === c.key && (sort.dir > 0 ? " ↑" : " ↓")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logRows.length === 0 && (
                  <tr>
                    <td colSpan={cols.length} className="text-dim">
                      No days match the search.
                    </td>
                  </tr>
                )}
                {logRows.map((d) => (
                  <tr key={d.date} className="hover:bg-panel-muted">
                    {cols.map((c) => {
                      if (c.key === "date")
                        return (
                          <td key={c.key} className="whitespace-nowrap">
                            {fmtDay(d.d, { weekday: "short", day: "2-digit", month: "short" })}
                          </td>
                        );
                      if (c.key === "kind")
                        return (
                          <td key={c.key} className="whitespace-nowrap text-dim">
                            {d.cal.kind && (
                              <span className="inline-flex items-center gap-1.5">
                                <i className="h-1.5 w-3.5 rounded-sm" style={{ background: DAY_KINDS[d.cal.kind].color }} />
                                {DAY_KINDS[d.cal.kind].name}
                              </span>
                            )}
                          </td>
                        );
                      if (c.key === "tag")
                        return (
                          <td key={c.key} className="whitespace-nowrap font-medium text-[var(--dining-event)]">
                            {d.tag && titleCase(d.tag)}
                          </td>
                        );
                      if (c.key === "notes")
                        return (
                          <td key={c.key} className="whitespace-nowrap text-dim">
                            {d.cal.notes.join(" · ")}
                          </td>
                        );
                      const v = cell(d, c.key) as number | null;
                      return (
                        <td key={c.key} className={cn("text-right tabular-nums", v == null && "text-dim", c.total && "font-semibold")}>
                          {fmt(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      </Section>
    </div>
  );
}

/** Dropdown of checkboxes, one per kind of school-calendar day, plus presets. */
function KindPicker({ value, onChange }: { value: DayKind[]; onChange: (v: DayKind[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const same = (a: DayKind[], b: DayKind[]) => a.length === b.length && a.every((k) => b.includes(k));
  const preset = KIND_PRESETS.find((p) => same(p.kinds, value));
  const summary = preset?.label ?? (value.length === 1 ? DAY_KINDS[value[0]].name : value.length === 0 ? "No days" : `${value.length} kinds of day`);
  const toggle = (k: DayKind) => onChange(value.includes(k) ? value.filter((x) => x !== k) : ALL_KINDS.filter((x) => x === k || value.includes(x)));

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      <span className="text-xs font-medium text-dim">School calendar</span>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="input inline-flex w-auto items-center gap-2 py-1.5"
      >
        {summary}
        <ChevronDown className="size-4 text-dim" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 grid w-64 gap-0.5 rounded-lg border border-line bg-panel p-1.5 text-sm shadow-lg">
          {KIND_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.kinds)}
              className={cn("rounded-md px-2 py-1.5 text-left hover:bg-panel-muted", preset === p && "font-medium text-accent")}
            >
              {p.label}
            </button>
          ))}
          <div className="my-1 border-t border-line" />
          {ALL_KINDS.map((k) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-panel-muted">
              <input type="checkbox" checked={value.includes(k)} onChange={() => toggle(k)} className="accent-[var(--accent)]" />
              <i className="h-1.5 w-3.5 shrink-0 rounded-sm" style={{ background: DAY_KINDS[k].color }} />
              {DAY_KINDS[k].name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-dim">{label}</span>
      <div className="inline-flex rounded-lg border border-line bg-panel p-0.5">
        {(Object.keys(options) as T[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            onClick={() => onChange(k)}
            className={cn("rounded-md px-2.5 py-1 text-sm", value === k ? "bg-panel-muted font-medium text-fg" : "text-dim hover:text-fg")}
          >
            {options[k]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-dim">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-dim">{note}</div>
    </div>
  );
}

function Legend({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-dim">{children}</div>;
}

function LegendItem({ color, label, wide }: { color: string; label: string; wide?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={cn("rounded-[3px]", wide ? "h-1.5 w-3.5" : "size-2.5")} style={{ background: color }} />
      {label}
    </span>
  );
}
