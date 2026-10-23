import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Copy, Printer, Trash2, TriangleAlert } from "lucide-react";
import { Badge, DeptBadge, Empty, PageHeader, Section } from "@/components/ui";
import { fieldLabelsFor, hasAssignedTo, parseExtra, parseReadings } from "@/lib/assets";
import { isAgentOf, requireUser } from "@/lib/auth";
import { requireDepartment } from "@/lib/department";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ipField } from "@/lib/printerSnmp";
import { assetQrSvg } from "@/lib/qr";
import { managedDepartments } from "@/lib/tickets";
import { isMessage } from "@/i18n";
import { activityText } from "@/i18n/activity";
import { getI18n } from "@/i18n/server";
import { ConfirmButton } from "../../boards/ConfirmButton";
import { addAssetNote, deleteAsset, readPrinterDetails, updateAsset } from "../actions";
import { AssetFields } from "../AssetFields";
import { PrintLabelsButton } from "../labels/PrintLabelsButton";
import { InkLevels } from "../InkLevels";
import { PrinterButton } from "../PrinterButton";

export default async function AssetPage({ params }: PageProps<"/inventory/[tag]">) {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const tag = decodeURIComponent((await params).tag).toUpperCase();
  const asset = await prisma.asset.findUnique({
    where: { tag },
    include: {
      department: true,
      location: true,
      tickets: { orderBy: { createdAt: "desc" }, take: 20 },
      activity: { include: { actor: true }, orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  // Each department sees only its own inventory.
  if (!asset || asset.departmentId !== (await requireDepartment()).id) notFound();

  const reportButton = (
    <Link href={`/tickets/new?asset=${asset.tag}`} className="btn btn-primary">
      <TriangleAlert className="size-4" /> {t("Report a problem")}
    </Link>
  );

  // Anyone scanning the QR label lands here: non-agents only get the basics
  // and a shortcut to open a ticket about this item.
  if (!isAgentOf(user, asset.departmentId)) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card p-6 text-center">
          <div className="font-mono text-xs text-dim">{asset.tag}</div>
          <h1 className="mt-1 text-xl font-semibold">{asset.name}</h1>
          <p className="mt-1 text-sm text-dim">
            {asset.type}
            {asset.location && ` · ${asset.location.name}`}
          </p>
          <div className="mt-6">{reportButton}</div>
          <p className="mt-3 text-xs text-dim">{t("Goes to {dept} with this item already attached.", { dept: asset.department.name })}</p>
        </div>
      </div>
    );
  }

  const readings = parseReadings(asset.readings);
  const [departments, locations, qr, fieldLabels, showAssignedTo] = await Promise.all([
    managedDepartments(user),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    assetQrSvg(asset.tag),
    fieldLabelsFor(asset.type, asset.departmentId),
    hasAssignedTo(asset.departmentId, asset.type),
  ]);

  return (
    <>
      <Link
        href={`/inventory?dept=${asset.department.slug}&type=${encodeURIComponent(asset.type)}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-dim hover:text-fg"
      >
        <ArrowLeft className="size-4" /> {asset.department.name} · {asset.type}
      </Link>
      <PageHeader
        title={asset.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{asset.tag}</span>
            <Badge value={asset.status} />
            <DeptBadge dept={asset.department} />
          </span>
        }
        actions={
          <>
            <Link href={`/inventory/new?copy=${asset.tag}`} className="btn" title={t("Add a new item pre-filled like this one")}>
              <Copy className="size-4" /> {t("Duplicate")}
            </Link>
            <PrintLabelsButton tags={[asset.tag]} className="btn">
              <Printer className="size-4" /> {t("Print label")}
            </PrintLabelsButton>
            {reportButton}
            <form action={deleteAsset.bind(null, asset.id)}>
              <ConfirmButton
                message={t("Delete this item permanently, with its history? To keep the history, set its status to Retired instead.")}
                className="btn btn-danger"
                title={t("Delete")}
              >
                <Trash2 className="size-4" />
              </ConfirmButton>
            </form>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-6">
          {ipField(parseExtra(asset.extra)) && (
            <Section
              title={t("Printer status")}
              actions={<PrinterButton action={readPrinterDetails.bind(null, asset.id)}>{t("Read now")}</PrinterButton>}
            >
              {readings ? (
                <div className="grid gap-6 p-5 sm:grid-cols-2">
                  <InkLevels supplies={readings.supplies} />
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                    {Object.entries(readings.fields).map(([k, v]) => (
                      <Fragment key={k}>
                        <dt className="text-dim">{isMessage(k) ? t(k) : k}</dt>
                        <dd className="min-w-0 break-words">{v}</dd>
                      </Fragment>
                    ))}
                    {readings.online === false ? (
                      <>
                        <dt className="text-dim">{t("Status")}</dt>
                        <dd className="text-danger">
                          {t("Not answering")}
                          {readings.checkedAt && ` (${t("checked {when}", { when: fmtDateTime(new Date(readings.checkedAt), locale) })})`}
                        </dd>
                      </>
                    ) : (
                      readings.alert && (
                        <>
                          <dt className="text-dim">{t("Status")}</dt>
                          <dd className={readings.alert.level === "error" ? "text-danger" : "text-amber-600 dark:text-amber-400"}>{readings.alert.message}</dd>
                        </>
                      )
                    )}
                    <dt className="text-dim">{t("Last read")}</dt>
                    <dd>{fmtDateTime(new Date(readings.readAt), locale)}</dd>
                  </dl>
                </div>
              ) : (
                <Empty>{t("Not read yet. Press “Read now”; it is also read automatically every few minutes.")}</Empty>
              )}
            </Section>
          )}

          <Section title={t("Details")}>
            <form action={updateAsset.bind(null, asset.id)} className="space-y-4 p-5">
              <AssetFields a={asset} departments={departments} locations={locations} fieldLabels={fieldLabels} showAssignedTo={showAssignedTo}
                readFromDevice={readings !== null}
              />
              <div className="flex justify-end">
                <button className="btn btn-primary">{t("Save changes")}</button>
              </div>
            </form>
          </Section>

          <Section title={t("Tickets")}>
            {asset.tickets.length === 0 ? (
              <Empty>{t("No tickets for this asset.")}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {asset.tickets.map((ticket) => (
                  <li key={ticket.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <Link href={`/tickets/${ticket.number}`} className="hover:underline">
                      <span className="text-dim">#{ticket.number}</span> {ticket.title}
                    </Link>
                    <span className="flex items-center gap-2 text-xs text-dim">
                      {fmtDate(ticket.createdAt, locale)} <Badge value={ticket.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside className="space-y-6">
          <Section title={t("QR label")}>
            <div className="p-4">
              <div className="mx-auto w-40 rounded-lg bg-white p-3 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="mt-2 text-center text-xs text-dim">{t("Scanning opens this page")}</p>
            </div>
          </Section>

          <Section title={t("History")}>
            <form action={addAssetNote.bind(null, asset.id)} className="flex gap-2 border-b border-line p-3">
              <input name="body" required placeholder={t("Add a note…")} className="input" />
              <button className="btn">{t("Add")}</button>
            </form>
            <ol className="divide-y divide-line">
              {asset.activity.map((a) => (
                <li key={a.id} className="px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-medium">{a.actor?.name ?? t("System")}</span> {activityText(a.body, locale)}
                  </div>
                  <div className="text-xs text-dim">{fmtDateTime(a.createdAt, locale)}</div>
                </li>
              ))}
            </ol>
          </Section>
        </aside>
      </div>
    </>
  );
}
