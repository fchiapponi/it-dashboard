// TASIS academic calendars, from the Parent Portal PDFs:
//   2025–26: https://www.tasis.ch/uploaded/documents/Parent_Portal/25_26/25_26_Academic_Year_Calendar.pdf
//   2026–27: https://www.tasis.ch/uploaded/documents/Parent_Portal/26_27/26_27_Academic_Year_Calendar.pdf
// Only dates from January 2026 on are listed. Add next year's here when it is published.

export type DayKind = "classes" | "weekend" | "special" | "orientation" | "holiday" | "summer";

export const DAY_KINDS: Record<DayKind, { name: string; short: string; color: string }> = {
  classes: { name: "Classes", short: "Classes", color: "var(--cal-classes)" },
  weekend: { name: "Weekend (school year)", short: "Weekend", color: "var(--cal-weekend)" },
  special: { name: "Special day", short: "Special", color: "var(--cal-special)" },
  orientation: { name: "Orientation", short: "Orient.", color: "var(--cal-orientation)" },
  holiday: { name: "Holiday / no school", short: "Holiday", color: "var(--cal-holiday)" },
  summer: { name: "Summer", short: "Summer", color: "var(--cal-summer)" },
};

/** [first day, last day or null, kind it gives those days (or null to keep the default), text] */
type CalendarEntry = [string, string | null, DayKind | null, string | null];

const ENTRIES: CalendarEntry[] = [
  // ---- 2025–26, spring semester
  ["2026-01-01", "2026-01-11", "holiday", "Winter Holiday"],
  ["2026-01-10", null, null, "Dormitories Open · 12:00"],
  ["2026-01-12", null, null, "Classes Resume"],
  ["2026-02-02", "2026-02-06", null, "International Week"],
  ["2026-02-16", "2026-02-19", "special", "MS Swiss Experience (Grade 6 until Wednesday)"],
  ["2026-02-18", null, "special", "ES Parent-Teacher Conferences (full day)"],
  ["2026-02-18", "2026-02-21", "special", "HS Academic Travel (dorms closed)"],
  ["2026-02-19", "2026-02-20", "special", "ES No School"],
  ["2026-02-20", null, "special", "MS No School"],
  ["2026-03-09", null, "holiday", "HS/MS/ES No School"],
  ["2026-03-16", null, "special", "MS Parent-Teacher Conferences (no MS classes)"],
  ["2026-03-27", null, null, "Last Day of Classes Before Spring Holiday"],
  ["2026-03-28", null, null, "Dormitories Close · 16:00"],
  ["2026-03-28", "2026-04-12", "holiday", "Spring Holiday"],
  ["2026-04-11", null, null, "Dormitories Open · 12:00"],
  ["2026-04-13", null, null, "Classes Resume"],
  ["2026-05-23", null, null, "Graduation"],
  ["2026-06-03", null, null, "MS Last Day of Classes"],
  ["2026-06-04", null, null, "HS Last Day of Exams · MS Moving-up Ceremony · ES Last Day of Classes"],
  ["2026-06-05", null, null, "ES Moving-up Ceremony · Dormitories Close 16:00"],
  // Not on the academic calendar: the weeks between the two school years.
  ["2026-06-06", "2026-08-30", "summer", null],
  // ---- 2026–27, fall semester
  ["2026-08-31", null, "orientation", "MS/HS Boarding and HS Day Student Orientation"],
  ["2026-08-31", "2026-09-02", "orientation", "HS/MS Boarding Student Orientation and Activities"],
  ["2026-09-01", null, "orientation", "ES Orientation"],
  ["2026-09-02", null, "orientation", "MS Day Student and Family Orientation"],
  ["2026-09-03", null, null, "First Day of Classes"],
  ["2026-10-15", null, "special", "HS/MS Family Weekend (special schedule and events)"],
  ["2026-10-16", null, "special", "HS/MS Family Weekend (Parent-Teacher Conferences) · HS/MS No School"],
  ["2026-10-19", null, "holiday", "HS/MS/ES No School"],
  ["2026-11-02", "2026-11-05", "special", "MS Swiss Experience (Grade 6 until Wednesday)"],
  ["2026-11-04", "2026-11-07", "special", "HS Academic Travel (dorms closed)"],
  ["2026-11-04", null, "special", "ES Parent-Teacher Conferences (full day)"],
  ["2026-11-05", "2026-11-06", "special", "ES No School"],
  ["2026-11-06", null, "special", "MS No School"],
  ["2026-11-27", null, "holiday", "HS/MS/ES No School (Thanksgiving Holiday)"],
  ["2026-12-18", null, null, "Last Day of Classes"],
  ["2026-12-19", null, null, "Dormitories Close · 16:00"],
  ["2026-12-19", "2027-01-10", "holiday", "Winter Holiday"],
  // ---- 2026–27, spring semester
  ["2027-01-09", null, null, "Dormitories Open · 12:00"],
  ["2027-01-11", null, null, "Classes Resume"],
  ["2027-02-08", "2027-02-11", "special", "MS Swiss Experience (Grade 6 until Wednesday)"],
  ["2027-02-10", "2027-02-13", "special", "HS Academic Travel (dorms closed)"],
  ["2027-02-10", null, "special", "ES Parent-Teacher Conferences (full day)"],
  ["2027-02-11", "2027-02-12", "special", "ES No School"],
  ["2027-02-12", null, "special", "MS No School"],
  ["2027-02-22", "2027-02-26", null, "International Week"],
  ["2027-03-01", null, "holiday", "HS/MS/ES No School"],
  ["2027-03-15", null, "special", "MS Parent-Teacher Conferences (no MS classes)"],
  ["2027-03-20", null, null, "Dormitories Close · 16:00"],
  ["2027-03-20", "2027-04-04", "holiday", "Spring Holiday"],
  ["2027-04-03", null, null, "Dormitories Open · 12:00"],
  ["2027-04-05", null, null, "Classes Resume"],
  ["2027-05-29", null, null, "Graduation"],
  ["2027-06-09", null, null, "MS Last Day of Classes"],
  ["2027-06-10", null, null, "HS Last Day of Exams · MS Moving-up Ceremony · ES Last Day of Classes"],
  ["2027-06-11", null, null, "ES Moving-up Ceremony · Dormitories Close 16:00"],
];

/** Last date the calendar covers; later days are not classified. */
export const CALENDAR_END = "2027-06-11";

// When kinds overlap on one day, the stronger one wins.
const RANK: Record<DayKind, number> = { holiday: 5, summer: 4, orientation: 3, special: 2, classes: 1, weekend: 1 };

export const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** 0 = Monday … 6 = Sunday */
export const weekday = (d: Date) => (d.getDay() + 6) % 7;
const shortDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export type CalendarDay = { kind: DayKind | null; notes: string[] };

let byDay: Map<string, CalendarDay> | null = null;

function build() {
  const map = new Map<string, { kind: DayKind | null; notes: string[] }>();
  for (const [from, to, kind, text] of ENTRIES) {
    const end = parseDay(to ?? from);
    for (let d = parseDay(from); d <= end; d.setDate(d.getDate() + 1)) {
      const k = dayKey(d);
      const entry = map.get(k) ?? { kind: null, notes: [] };
      if (kind && (!entry.kind || RANK[kind] > RANK[entry.kind])) entry.kind = kind;
      if (text) entry.notes.push(to ? `${text} (${shortDate(parseDay(from))} – ${shortDate(end)})` : text);
      map.set(k, entry);
    }
  }
  return map;
}

/** What the school calendar says about a day. kind is null outside the calendar's range. */
export function calendarDay(key: string): CalendarDay {
  byDay ??= build();
  const entry = byDay.get(key);
  if (key < "2026-01-01" || key > CALENDAR_END) return { kind: null, notes: entry?.notes ?? [] };
  const wd = weekday(parseDay(key));
  let kind = entry?.kind ?? null;
  // A special schedule on a Saturday or Sunday is still a weekend for the kitchen.
  if (!kind || (kind === "special" && wd >= 5)) kind = wd >= 5 ? "weekend" : "classes";
  return { kind, notes: entry?.notes ?? [] };
}
