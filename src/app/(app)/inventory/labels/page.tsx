import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { isAgent, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assetQrSvg } from "@/lib/qr";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

/** Page CSS for label printers: one label per page, landscape, no margins. */
const rollPage = (size: string) => `
@media print {
  @page { size: ${size}; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: white; }
  main { padding: 0 !important; }
  main > div { max-width: none !important; }
}`;

/*
 * Label printers, one label per page. In the print dialog pick the printer and
 * the paper below, margins None and scale 100%.
 * - QL-820NWB: DK-11201 die-cut labels, 29×90 mm.
 * - PT-P750W: 24 mm TZe tape, cut at 64 mm; only the middle ~18 mm of the
 *   tape is printable, hence the vertical padding.
 */
const ROLLS = {
  ql: {
    name: "Brother 29×90 mm",
    page: rollPage("90mm 29mm"),
    hint: "In the print dialog choose the Brother QL-820NWB, paper 29mm x 90mm (DK-11201), margins None, scale 100%.",
    label: "h-[29mm] w-[90mm] gap-[3mm] px-[3mm] py-[2mm]",
    qr: "h-[24mm] w-[24mm]",
    caption: "text-[7pt]",
    tag: "text-[14pt]",
    title: "line-clamp-2 text-[8pt]",
    footer: "mt-[1mm] text-[6.5pt]",
  },
  pt: {
    name: "P-touch 24 mm",
    page: rollPage("64mm 24mm"),
    hint: "In the print dialog choose the Brother PT-P750W, paper 24mm tape (TZe), margins None, scale 100%.",
    label: "h-[24mm] w-[64mm] gap-[2mm] px-[2mm] py-[3mm]",
    qr: "h-[18mm] w-[18mm]",
    caption: "text-[5.5pt]",
    tag: "text-[11pt]",
    title: "truncate text-[6.5pt]",
    footer: "text-[5pt]",
  },
} as const;

/** Printable QR labels for the assets passed as ?tag=…&tag=…, as an A4 sheet or for a label printer (?format=ql|pt). */
export default async function LabelsPage({ searchParams }: PageProps<"/inventory/labels">) {
  const user = await requireUser();
  if (!isAgent(user)) notFound();
  const { t } = await getI18n();
  const params = await searchParams;
  const raw = params.tag;
  const tags = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((tag) => tag.toUpperCase());
  const roll = params.format === "ql" || params.format === "pt" ? ROLLS[params.format] : null;

  const assets = await prisma.asset.findMany({ where: { tag: { in: tags } }, orderBy: { tag: "asc" } });
  const labels = await Promise.all(assets.map(async (a) => ({ ...a, qr: await assetQrSvg(a.tag) })));

  const href = (format?: string) => {
    const q = new URLSearchParams(tags.map((tag) => ["tag", tag]));
    if (format) q.set("format", format);
    return `/inventory/labels?${q}`;
  };

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {t(labels.length === 1 ? "{n} label" : "{n} labels", { n: labels.length })}
        </h1>
        <div className="flex gap-2">
          <Link href={href()} className={roll ? "btn" : "btn btn-primary"}>
            {t("A4 sheet")}
          </Link>
          {Object.entries(ROLLS).map(([format, r]) => (
            <Link key={format} href={href(format)} className={r === roll ? "btn btn-primary" : "btn"}>
              {r.name}
            </Link>
          ))}
          <PrintButton />
        </div>
      </div>
      {labels.length === 0 && <p className="text-sm text-dim">{t("Select assets in the inventory list first.")}</p>}

      {roll ? (
        <>
          <style>{roll.page}</style>
          <p className="no-print mb-4 text-sm text-dim">{t(roll.hint)}</p>
          <div className="flex flex-col gap-3 print:block">
            {labels.map((a) => (
              <div
                key={a.id}
                className={cn("flex items-center overflow-hidden border border-zinc-300 bg-white text-black break-after-page last:break-after-auto print:border-0", roll.label)}
              >
                <div className={cn("shrink-0 [&_svg]:h-full [&_svg]:w-full", roll.qr)} dangerouslySetInnerHTML={{ __html: a.qr }} />
                <div className="min-w-0 leading-tight">
                  <div className={cn("font-semibold tracking-wider uppercase", roll.caption)}>{t("TASIS property")}</div>
                  <div className={cn("font-mono font-bold", roll.tag)}>{a.tag}</div>
                  <div className={roll.title}>{a.name}</div>
                  <div className={roll.footer}>{t("Problem? Scan to report")}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
          {labels.map((a) => (
            <div key={a.id} className="flex break-inside-avoid items-center gap-3 rounded-lg border border-zinc-300 bg-white p-3 text-black">
              <div className="w-20 shrink-0 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: a.qr }} />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold tracking-wider uppercase">{t("TASIS property")}</div>
                <div className="font-mono text-sm font-bold">{a.tag}</div>
                <div className="truncate text-xs">{a.name}</div>
                <div className="mt-1 text-[10px] text-zinc-600">{t("Problem? Scan to report")}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
