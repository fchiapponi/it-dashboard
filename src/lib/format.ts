const TZ = "Europe/Zurich";

export function fmtDateTime(d: Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function fmtTime(d: Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
}

export function fmtRelative(d: Date) {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return fmtDate(d);
}

/** Value for <input type="datetime-local"> in school time. */
export function toLocalInput(d: Date | null | undefined) {
  if (!d) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Parses a datetime-local / date input value as school (Zurich) time. */
export function fromLocalInput(value: string | null): Date | null {
  if (!value) return null;
  const [date, time = "00:00"] = value.split("T");
  const asUtc = new Date(`${date}T${time}:00Z`);
  if (Number.isNaN(asUtc.getTime())) return null;
  // Shift by the Zurich offset at that moment (handles CET/CEST).
  const zurich = new Date(asUtc.toLocaleString("en-US", { timeZone: TZ }));
  const utc = new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(asUtc.getTime() - (zurich.getTime() - utc.getTime()));
}

/** Start of today in school time. */
export function startOfToday() {
  return fromLocalInput(toLocalInput(new Date()).slice(0, 10))!;
}

/** Only allow same-site relative paths after login. */
export function safeReturnTo(value: string | null | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

// ----------------------------------------------------------------- form data

export function str(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export function req(form: FormData, key: string) {
  const v = str(form, key);
  if (!v) throw new Error(`Missing field: ${key}`);
  return v;
}

export function int(form: FormData, key: string) {
  const v = str(form, key);
  if (v === null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

// -------------------------------------------------------------------- labels

export const TICKET_STATUSES = ["open", "in_progress", "waiting", "standby", "resolved", "closed"] as const;
export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const ASSET_STATUSES = ["in_use", "in_stock", "repair", "retired"] as const;
export const EVENT_STATUSES = ["requested", "confirmed", "cancelled"] as const;

export const LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting: "Waiting",
  standby: "Standby",
  resolved: "Resolved",
  closed: "Closed",
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
  in_use: "In use",
  in_stock: "In stock",
  repair: "In repair",
  retired: "Retired",
  requested: "Requested",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  received: "Waiting for pickup",
  collected: "Collected",
  returned: "Returned to sender",
};

export const label = (key: string) => LABELS[key] ?? key;

export const TONES: Record<string, "blue" | "amber" | "green" | "gray" | "red" | "violet" | "cyan"> = {
  open: "blue",
  in_progress: "violet",
  waiting: "amber",
  standby: "cyan",
  resolved: "green",
  closed: "gray",
  low: "gray",
  normal: "blue",
  high: "amber",
  urgent: "red",
  in_use: "green",
  in_stock: "blue",
  repair: "amber",
  retired: "gray",
  requested: "amber",
  confirmed: "green",
  cancelled: "gray",
  received: "amber",
  collected: "green",
  returned: "gray",
};
