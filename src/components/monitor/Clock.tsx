"use client";

import { useEffect, useState } from "react";
import { INTL } from "@/i18n";
import { useI18n } from "@/i18n/client";

export function Clock() {
  const { locale } = useI18n();
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

  if (!now) {
    return <span className="tabular-nums text-[var(--text-dim)]">--:--:--</span>;
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="tabular-nums text-[var(--accent)] glow-text">
        {now.toLocaleTimeString(INTL[locale])}
      </span>
      <span className="text-[var(--text-faint)]">
        {now.toLocaleDateString(INTL[locale], { weekday: "short", day: "2-digit", month: "short" })}
      </span>
    </div>
  );
}
