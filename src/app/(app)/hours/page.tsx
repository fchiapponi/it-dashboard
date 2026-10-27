import Link from "next/link";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Field, PageHeader, Section, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { requireDepartmentPage } from "@/lib/department";
import { toLocalInput } from "@/lib/format";
import { DAY_HOURS, daysOff, ENTRY_KINDS, ENTRY_LABELS, expectedHours, holiday, overtime, workedHours } from "@/lib/hours";
import { prisma } from "@/lib/prisma";
import { dayKey, parseDay, weekday } from "@/lib/schoolCalendar";
import { cn } from "@/lib/utils";
import { INTL, type Locale } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { resetDay, saveDay, setVacationAllowance } from "./actions";

const KIND_CLASSES: Record<string, string> = {
  vacation: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  sick: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
};

const fmtNum = (n: number, locale: Locale) => new Intl.NumberFormat(INTL[locale], { maximumFractionDigits: 2 }).format(n);
const fmtSigned = (n: number, locale: Locale) =>
  `${n > 0 ? "+" : n < 0 ? "−" : "±"}${fmtNum(Math.abs(n), locale)} h`;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export default async function HoursPage({ searchParams }: PageProps<"/hours">) {
  const user = await requireUser();
  // IT's page: for IT's members (and admins).
  await requireDepartmentPage("it");
  const sp = await searchParams;
  const { t, locale } = await getI18n();

  const today = toLocalInput(new Date()).slice(0, 10);
  const selected = typeof sp.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : today;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : selected.slice(0, 7);
  const year = month.slice(0, 4);

  const [entries, { vacationDays }] = await Promise.all([
    prisma.timeEntry.findMany({ where: { userId: user.id }, orderBy: { day: "asc" } }),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { vacationDays: true } }),
  ]);
  const byDay = new Map(entries.map((e) => [e.day, e]));
  const past = entries.filter((e) => e.day <= today);
  const inYear = entries.filter((e) => e.day.startsWith(year));
  const inMonth = entries.filter((e) => e.day.startsWith(month));

  const balance = sum(past.map(overtime));
  const monthOvertime = sum(inMonth.filter((e) => e.day <= today).map(overtime));
  const vacationTaken = sum(inYear.filter((e) => e.kind === "vacation" && e.day <= today).map(daysOff));
  const vacationPlanned = sum(inYear.filter((e) => e.kind === "vacation" && e.day > today).map(daysOff));
  const sickDays = sum(inYear.filter((e) => e.kind === "sick").map(daysOff));
  const vacationLeft = vacationDays - vacationTaken - vacationPlanned;

  // The month grid, Monday first, padded to whole weeks.
  const first = parseDay(`${month}-01`);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => dayKey(new Date(first.getFullYear(), first.getMonth(), i + 1)));
  const cells: (string | null)[] = [...Array(weekday(first)).fill(null), ...monthDays];
  while (cells.length % 7) cells.push(null);
  const shift = (n: number) => dayKey(new Date(first.getFullYear(), first.getMonth() + n, 1)).slice(0, 7);
  const href = (m: string, day?: string) => `/hours?month=${m}${day ? `&day=${day}` : ""}`;

  const monthExpected = sum(monthDays.map(expectedHours));
  const monthWorked = sum(monthDays.map((d) => workedHours(d, byDay.get(d))));
  const monthOff = sum(inMonth.map((e) => daysOff(e) * DAY_HOURS));

  const monthName = new Intl.DateTimeFormat(INTL[locale], { month: "long", year: "numeric" }).format(first);
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(INTL[locale], { weekday: "short" }).format(new Date(2024, 0, 1 + i)),
  );
  const longDate = (key: string) =>
    new Intl.DateTimeFormat(INTL[locale], { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(parseDay(key));

  const entry = byDay.get(selected);
  const selectedHoliday = holiday(selected);
  const selectedExpected = expectedHours(selected);

  return (
    <>
      <PageHeader
        title={t("Hours")}
        subtitle={t("{n} hours a day, Monday to Friday. Only log the days that differ.", { n: DAY_HOURS })}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("Overtime balance")} value={fmtSigned(balance, locale)} tone={balance < 0 ? "red" : undefined} />
        <Stat label={t("Overtime in {month}", { month: monthName })} value={fmtSigned(monthOvertime, locale)} />
        <Stat
          label={t("Vacation left in {year}", { year })}
          value={`${fmtNum(vacationLeft, locale)} / ${vacationDays}`}
          tone={vacationLeft < 0 ? "red" : undefined}
        />
        <Stat label={t("Sick days in {year}", { year })} value={fmtNum(sickDays, locale)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Section
          className="min-w-0"
          title={<span className="capitalize">{monthName}</span>}
          actions={
            <div className="flex gap-1">
              <Link href={href(shift(-1))} className="btn px-2" title={t("Previous month")}>
                <ChevronLeft className="size-4" />
              </Link>
              <Link href={href(today.slice(0, 7), today)} className="btn">
                {t("Today")}
              </Link>
              <Link href={href(shift(1))} className="btn px-2" title={t("Next month")}>
                <ChevronRight className="size-4" />
              </Link>
            </div>
          }
        >
          <div className="grid grid-cols-7 border-b border-line text-center text-xs font-medium text-dim">
            {weekdays.map((w) => (
              <div key={w} className="py-2 capitalize">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((key, i) => {
              if (!key) return <div key={`pad-${i}`} className="min-h-20 border-r border-b border-line bg-panel-muted/50 sm:min-h-24" />;
              const e = byDay.get(key);
              const name = holiday(key);
              const off = expectedHours(key) === 0;
              const ot = e ? overtime(e) : 0;
              return (
                <Link
                  key={key}
                  href={href(month, key)}
                  className={cn(
                    "relative flex min-h-20 flex-col gap-1 border-r border-b border-line p-1.5 text-xs hover:bg-panel-muted sm:min-h-24 sm:p-2",
                    off && "bg-panel-muted/60",
                    key === selected && "ring-2 ring-accent ring-inset",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-sm tabular-nums",
                      key === today && "bg-accent font-semibold text-accent-fg",
                      key !== today && (off ? "text-dim" : "font-medium"),
                      key !== today && name && "text-red-600 dark:text-red-400",
                    )}
                  >
                    {Number(key.slice(8))}
                  </span>
                  {name && <span className="line-clamp-2 leading-tight text-red-600 dark:text-red-400">{t(name)}</span>}
                  {e && e.kind !== "work" && (
                    <span className={cn("rounded px-1 py-0.5 leading-tight font-medium", KIND_CLASSES[e.kind])}>
                      {t(ENTRY_LABELS[e.kind as keyof typeof ENTRY_LABELS])}
                      {e.hours < DAY_HOURS && ` · ${fmtNum(e.hours, locale)} h`}
                    </span>
                  )}
                  {e?.kind === "work" && (
                    <span className="tabular-nums">
                      <span className="font-medium">{fmtNum(e.hours, locale)} h</span>{" "}
                      {ot !== 0 && (
                        <span className={ot > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                          {fmtSigned(ot, locale)}
                        </span>
                      )}
                    </span>
                  )}
                  {!e && !off && <span className="text-dim tabular-nums">{fmtNum(DAY_HOURS, locale)} h</span>}
                </Link>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-3 text-sm text-dim">
            <span>
              {t("Worked")}: <span className="font-medium text-fg tabular-nums">{fmtNum(monthWorked, locale)} h</span>
            </span>
            <span>
              {t("Expected")}: <span className="font-medium text-fg tabular-nums">{fmtNum(monthExpected, locale)} h</span>
            </span>
            <span>
              {t("Vacation / sick")}: <span className="font-medium text-fg tabular-nums">{fmtNum(monthOff, locale)} h</span>
            </span>
          </div>
        </Section>

        <div className="space-y-6 self-start">
          <Section title={<span className="first-letter:uppercase">{longDate(selected)}</span>}>
            <div className="px-4 pt-3 text-sm text-dim">
              {selectedHoliday
                ? t("Public holiday: {name}", { name: t(selectedHoliday) })
                : selectedExpected
                  ? t("Working day · {n} h expected", { n: selectedExpected })
                  : t("Weekend")}
            </div>
            <form key={selected} action={saveDay} className="grid gap-3 p-4">
              <input type="hidden" name="day" value={selected} />
              <div className="grid grid-cols-[1fr_100px] gap-3">
                <Field label={t("Type")}>
                  <select name="kind" defaultValue={entry?.kind ?? "work"} className="input">
                    {ENTRY_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t(ENTRY_LABELS[k])}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Hours")}>
                  <input
                    name="hours"
                    type="number"
                    min={0}
                    max={24}
                    step={0.25}
                    defaultValue={entry?.hours ?? (selectedExpected || DAY_HOURS)}
                    className="input"
                  />
                </Field>
              </div>
              <p className="-mt-1 text-xs text-dim">{t("For vacation or sick leave, the hours off: 8 for a full day, 4 for half.")}</p>
              <Field label={t("Until (optional, every working day up to this date)")}>
                <input name="until" type="date" min={selected} className="input" />
              </Field>
              <Field label={t("Note")}>
                <input name="note" defaultValue={entry?.note ?? ""} className="input" />
              </Field>
              <div className="flex gap-2">
                <button className="btn btn-primary flex-1">{t("Save")}</button>
                {entry && (
                  <button formAction={resetDay} className="btn" title={t("Back to the default {n} hours", { n: DAY_HOURS })}>
                    <RotateCcw className="size-4" /> {t("Reset")}
                  </button>
                )}
              </div>
            </form>
          </Section>

          <Section title={t("Vacation {year}", { year })}>
            <div className="grid gap-1 px-4 pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-dim">{t("Taken")}</span>
                <span className="tabular-nums">{fmtNum(vacationTaken, locale)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dim">{t("Planned")}</span>
                <span className="tabular-nums">{fmtNum(vacationPlanned, locale)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>{t("Remaining")}</span>
                <span className="tabular-nums">{fmtNum(vacationLeft, locale)}</span>
              </div>
            </div>
            <form action={setVacationAllowance} className="flex items-end gap-2 p-4">
              <Field label={t("Vacation days per year")} className="flex-1">
                <input name="vacationDays" type="number" min={0} max={100} defaultValue={vacationDays} className="input" />
              </Field>
              <button className="btn">{t("Save")}</button>
            </form>
          </Section>
        </div>
      </div>
    </>
  );
}
