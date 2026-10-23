// Working hours: an 8-hour day Monday to Friday, except Swiss public holidays.
// Only days that differ are stored (TimeEntry); every other working day counts
// as exactly 8 hours, so it neither adds nor takes from the overtime balance.

import type { Message } from "@/i18n";
import { dayKey, parseDay, weekday } from "@/lib/schoolCalendar";

export const DAY_HOURS = 8;

export const ENTRY_KINDS = ["work", "vacation", "sick"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const ENTRY_LABELS: Record<EntryKind, Message> = { work: "Worked", vacation: "Vacation", sick: "Sick" };

// Public holidays in Ticino (TASIS is in Montagnola): the federal 1 August plus
// the cantonal ones. Good Friday is not a holiday in Ticino.
const FIXED: [string, Message][] = [
  ["01-01", "New Year's Day"],
  ["01-06", "Epiphany"],
  ["03-19", "Saint Joseph"],
  ["05-01", "Labour Day"],
  ["06-29", "Saints Peter and Paul"],
  ["08-01", "Swiss National Day"],
  ["08-15", "Assumption"],
  ["11-01", "All Saints' Day"],
  ["12-08", "Immaculate Conception"],
  ["12-25", "Christmas Day"],
  ["12-26", "Saint Stephen's Day"],
];

// Days after Easter Sunday.
const MOVABLE: [number, Message][] = [
  [1, "Easter Monday"],
  [39, "Ascension Day"],
  [50, "Whit Monday"],
  [60, "Corpus Christi"],
];

/** Easter Sunday (Gregorian), by the anonymous algorithm. */
function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const byYear = new Map<number, Map<string, Message>>();

/** The public holidays of a year, by YYYY-MM-DD. */
export function holidays(year: number) {
  let map = byYear.get(year);
  if (!map) {
    map = new Map(FIXED.map(([md, name]) => [`${year}-${md}`, name]));
    const sunday = easter(year);
    for (const [offset, name] of MOVABLE) {
      const d = new Date(sunday);
      d.setDate(d.getDate() + offset);
      map.set(dayKey(d), name);
    }
    byYear.set(year, map);
  }
  return map;
}

export const holiday = (key: string) => holidays(Number(key.slice(0, 4))).get(key) ?? null;

/** Hours a day is expected to have: 8 on a working day, 0 on weekends and holidays. */
export const expectedHours = (key: string) => (weekday(parseDay(key)) >= 5 || holiday(key) ? 0 : DAY_HOURS);

/** Every YYYY-MM-DD from `from` to `to`, both included. */
export function daysBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = parseDay(from), end = parseDay(to); d <= end; d.setDate(d.getDate() + 1)) out.push(dayKey(d));
  return out;
}

type Entry = { day: string; kind: string; hours: number };

/** Overtime a stored day adds to the balance. Vacation and sick days count as a normal day. */
export const overtime = (e: Entry) => (e.kind === "work" ? e.hours - expectedHours(e.day) : 0);

/** Working days a vacation or sick entry uses (a half day is 0.5). */
export const daysOff = (e: Entry) => (e.kind !== "work" && expectedHours(e.day) ? e.hours / DAY_HOURS : 0);

/** Hours a day ends up with: the stored hours worked, else the default. */
export const workedHours = (key: string, e?: Entry) =>
  !e ? expectedHours(key) : e.kind === "work" ? e.hours : Math.max(0, expectedHours(key) - e.hours);
