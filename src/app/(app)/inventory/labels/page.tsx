import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { isAgent, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assetQrSvg } from "@/lib/qr";
import { getI18n } from "@/i18n/server";

/*
 * Brother QL-820NWB with DK-11201 die-cut labels (29×90 mm): one label per page,
 * landscape. In the print dialog pick the Brother, paper "29mm x 90mm",
 * margins None and scale 100%.
 */
const QL_PAGE = `
@media print {
  @page { size: 90mm 29mm; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: white; }
  main { padding: 0 !important; }
  main > div { max-width: none !important; }
}`;

/** Printable QR labels for the assets passed as ?tag=…&tag=…, as an A4 sheet or Brother QL rolls (?format=ql). */
export default async function LabelsPage({ searchParams }: PageProps<"/inventory/labels">) {
  const user = await requireUser();
  if (!isAgent(user)) notFound();
  const { t } = await getI18n();
  const params = await searchParams;
  const raw = params.tag;
  const tags = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((tag) => tag.toUpperCase());
  const ql = params.format === "ql";

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
          <Link href={href()} className={ql ? "btn" : "btn btn-primary"}>
            {t("A4 sheet")}
          </Link>
          <Link href={href("ql")} className={ql ? "btn btn-primary" : "btn"}>
            Brother 29×90 mm
          </Link>
          <PrintButton />
        </div>
      </div>
      {labels.length === 0 && <p className="text-sm text-dim">{t("Select assets in the inventory list first.")}</p>}

      {ql ? (
        <>
          <style>{QL_PAGE}</style>
          <p className="no-print mb-4 text-sm text-dim">
            {t("In the print dialog choose the Brother QL-820NWB, paper 29mm x 90mm (DK-11201), margins None, scale 100%.")}
          </p>
          <div className="flex flex-col gap-3 print:block">
            {labels.map((a) => (
              <div
                key={a.id}
                className="flex h-[29mm] w-[90mm] items-center gap-[3mm] overflow-hidden border border-zinc-300 bg-white px-[3mm] py-[2mm] text-black break-after-page last:break-after-auto print:border-0"
              >
                <div className="h-[24mm] w-[24mm] shrink-0 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: a.qr }} />
                <div className="min-w-0 leading-tight">
                  <div className="text-[7pt] font-semibold tracking-wider uppercase">{t("TASIS property")}</div>
                  <div className="font-mono text-[14pt] font-bold">{a.tag}</div>
                  <div className="line-clamp-2 text-[8pt]">{a.name}</div>
                  <div className="mt-[1mm] text-[6.5pt]">{t("Problem? Scan to report")}</div>
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
