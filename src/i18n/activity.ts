import { label, LABELS } from "@/lib/format";
import type { Locale } from ".";

// Activity entries are stored once, in English, as "<who> <what>". This turns the
// "what" into Italian for display; anything it doesn't recognise stays as written.

const status = (english: string) => {
  const key = Object.keys(LABELS).find((k) => LABELS[k] === english);
  return key ? label(key, "it") : english;
};

const PHRASES: [RegExp, string | ((...m: string[]) => string)][] = [
  [/changed (status|priority) to ([^,(]+?)(?=$|, | \()/g, (_, what, value) => `ha cambiato ${what === "status" ? "lo stato" : "la priorità"} in ${status(value)}`],
  [/created this ticket/g, "ha creato questo ticket"],
  [/took this ticket/g, "ha preso in carico questo ticket"],
  [/closed this ticket/g, "ha chiuso questo ticket"],
  [/reopened by email reply/g, "ha riaperto il ticket rispondendo via email"],
  [/reopened by reply/g, "ha riaperto il ticket rispondendo"],
  [/removed the due date/g, "ha rimosso la scadenza"],
  [/set the due date to /g, "ha impostato la scadenza al "],
  [/returned \(unassigned\)/g, "restituito (non assegnato)"],
  [/(^|, )unassigned /g, "$1ha tolto l'assegnazione a "],
  [/(^|, )assigned to /g, "$1ha assegnato a "],
  [/(^|, )moved to no location/g, "$1ha rimosso la posizione"],
  [/(^|, )moved to /g, "$1ha spostato in "],
  [/^used (\d+) (.+?) of /, "ha usato $1 $2 di "],
  [/added to inventory/g, "ha aggiunto all'inventario"],
  [/edited details/g, "ha modificato i dettagli"],
  [/changed department/g, "ha cambiato reparto"],
  [/(^|, )set (.+?) to /g, "$1ha impostato $2 a "],
  [/(^|, )cleared /g, "$1ha svuotato "],
  [/(^|, )changed /g, "$1ha modificato "],
  [/ \(bulk edit\)$/, " (modifica multipla)"],
  [/ \(table edit\)$/, " (modifica in tabella)"],
  [/^read details from the printer at /, "ha letto i dettagli dalla stampante all'indirizzo "],
  [/^sent by email to (\S+) and sorted by AI$/, "inviato via email a $1 e smistato dall'IA"],
  [
    /^sent by email to (\S+)\. The AI couldn't sort it, so check the department and category\.$/,
    "inviato via email a $1. L'IA non è riuscita a smistarlo: controlla reparto e categoria.",
  ],
];

export function activityText(body: string, locale: Locale) {
  if (locale === "en") return body;
  return PHRASES.reduce((text, [re, to]) => text.replace(re, to as string), body);
}
