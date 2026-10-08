"use client";

import { useEffect, useState } from "react";

export function Clock() {
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
        {now.toLocaleTimeString("en-GB")}
      </span>
      <span className="text-[var(--text-faint)]">
        {now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}
      </span>
    </div>
  );
}
