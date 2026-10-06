import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { isReception, requireUser } from "@/lib/auth";
import { fmtDate, fmtTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** Printable visitor badge (fits a standard 86×54 mm badge sleeve). */
export default async function VisitorBadgePage({ params }: PageProps<"/visitors/[id]/badge">) {
  const user = await requireUser();
  if (!isReception(user)) notFound();
  const v = await prisma.visitor.findUnique({ where: { id: (await params).id }, include: { host: true } });
  if (!v || !v.checkedInAt) notFound();

  return (
    <>
      <div className="no-print mb-6 flex justify-end">
        <PrintButton />
      </div>
      <div className="mx-auto flex h-[54mm] w-[86mm] flex-col justify-between rounded-lg border border-zinc-300 bg-white p-4 text-black">
        <div className="flex items-center justify-between text-[10px] font-semibold tracking-widest uppercase">
          <span>TASIS</span>
          <span className="rounded bg-black px-1.5 py-0.5 text-white">Visitor</span>
        </div>
        <div>
          <div className="text-xl leading-tight font-bold">{v.name}</div>
          {v.company && <div className="text-xs">{v.company}</div>}
        </div>
        <div className="flex justify-between text-[10px] text-zinc-700">
          <span>Host: {v.host?.name ?? v.hostName ?? "—"}</span>
          <span>
            {fmtDate(v.checkedInAt)} {fmtTime(v.checkedInAt)}
            {v.badgeNumber && ` · #${v.badgeNumber}`}
          </span>
        </div>
      </div>
    </>
  );
}
