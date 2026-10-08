import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { isAgent, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assetQrSvg } from "@/lib/qr";

/** Printable sheet of QR labels for the assets passed as ?tag=…&tag=… */
export default async function LabelsPage({ searchParams }: PageProps<"/inventory/labels">) {
  const user = await requireUser();
  if (!isAgent(user)) notFound();
  const raw = (await searchParams).tag;
  const tags = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((t) => t.toUpperCase());

  const assets = await prisma.asset.findMany({ where: { tag: { in: tags } }, orderBy: { tag: "asc" } });
  const labels = await Promise.all(assets.map(async (a) => ({ ...a, qr: await assetQrSvg(a.tag) })));

  return (
    <>
      <div className="no-print mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {labels.length} label{labels.length === 1 ? "" : "s"}
        </h1>
        <PrintButton />
      </div>
      {labels.length === 0 && <p className="text-sm text-dim">Select assets in the inventory list first.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
        {labels.map((a) => (
          <div key={a.id} className="flex break-inside-avoid items-center gap-3 rounded-lg border border-zinc-300 bg-white p-3 text-black">
            <div className="w-20 shrink-0 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: a.qr }} />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold tracking-wider uppercase">TASIS property</div>
              <div className="font-mono text-sm font-bold">{a.tag}</div>
              <div className="truncate text-xs">{a.name}</div>
              <div className="mt-1 text-[10px] text-zinc-600">Problem? Scan to report</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
