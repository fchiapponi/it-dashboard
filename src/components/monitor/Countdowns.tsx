"use client";

import { useEffect, useState } from "react";

function nextFiveDeadline(now: Date): Date {
  const target = new Date(now);
  target.setHours(17, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target;
}

function nextFridayFive(now: Date): Date {
  const target = new Date(now);
  target.setHours(17, 0, 0, 0);
  const daysUntilFriday = (5 - target.getDay() + 7) % 7;
  target.setDate(target.getDate() + daysUntilFriday);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 7);
  return target;
}

function formatHMS(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function formatDH(ms: number): string {
  const totalHours = Math.max(0, Math.floor(ms / (1000 * 60 * 60)));
  const d = Math.floor(totalHours / 24);
  const h = totalHours % 24;
  if (d === 0 && h === 0) return "it's Friday 17:00";
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

function nextChristmas(now: Date): Date {
  const target = new Date(now.getFullYear(), 11, 25, 0, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setFullYear(target.getFullYear() + 1);
  return target;
}

function formatDays(ms: number): string {
  const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  if (days === 0) return "today!";
  return `${days}d`;
}

export function Countdowns() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    const initial = setTimeout(update, 0);
    const timer = setInterval(update, 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, []);

  if (!now) return null;

  const toFive = nextFiveDeadline(now).getTime() - now.getTime();
  const toFridayFive = nextFridayFive(now).getTime() - now.getTime();
  const toChristmas = nextChristmas(now).getTime() - now.getTime();

  return (
    <div className="flex items-center gap-3 text-[0.625rem]">
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--text-faint)] uppercase tracking-wider">17:00 in</span>
        <span className="tabular-nums text-[var(--amber)]">{formatHMS(toFive)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--text-faint)] uppercase tracking-wider">Friday 17:00 in</span>
        <span className="tabular-nums text-[var(--cyan)]">{formatDH(toFridayFive)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--text-faint)] uppercase tracking-wider">Christmas in</span>
        <span className="tabular-nums text-[var(--accent)]">{formatDays(toChristmas)}</span>
      </div>
    </div>
  );
}
