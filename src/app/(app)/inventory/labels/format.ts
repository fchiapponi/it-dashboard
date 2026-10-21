/** Cookie holding the last label format used (a4, ql or pt). */
export const LABEL_FORMAT_COOKIE = "labelFormat";

/** The label formats, in the order they are offered. Names are English UI strings. */
export const LABEL_FORMATS = [
  { key: "a4", name: "A4 sheet" },
  { key: "ql", name: "Brother 29×90 mm" },
  { key: "pt", name: "P-touch 24 mm" },
] as const;

/** The labels page for these tags in one format, opening the print dialog. */
export function labelsHref(tags: string[], format: string) {
  const q = new URLSearchParams(tags.map((tag) => ["tag", tag]));
  q.set("format", format);
  q.set("print", "1");
  return `/inventory/labels?${q}`;
}
