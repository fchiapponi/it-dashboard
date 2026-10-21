import { TONES } from "@/lib/format";

export const TONE_CLASSES = {
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  amber: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  gray: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  red: "bg-red-500/10 text-red-700 dark:text-red-300",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  cyan: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
};

/** Color classes for a status/priority key, as used by Badge. */
export function toneClasses(value: string) {
  return TONE_CLASSES[TONES[value] ?? "gray"];
}
