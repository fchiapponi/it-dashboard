import { Check, Undo2 } from "lucide-react";
import { Badge, Empty, Field, PageHeader, Section, TableWrap } from "@/components/ui";
import { isReception, requireUser } from "@/lib/auth";
import { requireDepartmentPage } from "@/lib/department";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/i18n/server";
import { logDelivery, markCollected, markReturned, undoCollected } from "./actions";

const CARRIERS = ["Swiss Post", "DHL", "UPS", "FedEx", "DPD", "TNT", "Planzer", "Amazon", "Courier", "Hand delivered"];

export default async function DeliveriesPage() {
  const user = await requireUser();
  // Reception's page: for Reception's members (and admins).
  await requireDepartmentPage("reception");
  const { t, locale } = await getI18n();
  const include = { recipient: true, receivedBy: true } as const;

  if (!isReception(user)) {
    const mine = await prisma.delivery.findMany({
      where: { recipientId: user.id },
      include,
      orderBy: { receivedAt: "desc" },
      take: 50,
    });
    const waiting = mine.filter((d) => d.status === "received");
    return (
      <>
        <PageHeader
          title={t("Deliveries")}
          subtitle={waiting.length ? t("{n} waiting for you at reception", { n: waiting.length }) : t("Nothing waiting for you at reception")}
        />
        <Section>
          {mine.length === 0 ? (
            <Empty>{t("No deliveries logged for you yet.")}</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {mine.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {d.packages > 1 ? t("{n} packages", { n: d.packages }) : t("Package")}
                      {d.carrier && ` · ${d.carrier}`}
                      {d.description && <span className="font-normal text-dim"> — {d.description}</span>}
                    </div>
                    <div className="text-xs text-dim">
                      {t("Arrived {when}", { when: fmtDateTime(d.receivedAt, locale) })}
                      {d.trackingNumber && ` · ${d.trackingNumber}`}
                      {d.status === "collected" && ` · ${t("collected {when}", { when: fmtDateTime(d.collectedAt, locale) })}`}
                    </div>
                  </div>
                  <Badge value={d.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </>
    );
  }

  const [waiting, done, users] = await Promise.all([
    prisma.delivery.findMany({ where: { status: "received" }, include, orderBy: { receivedAt: "asc" } }),
    prisma.delivery.findMany({ where: { status: { not: "received" } }, include, orderBy: { collectedAt: "desc" }, take: 30 }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title={t("Deliveries")} subtitle={t("{n} waiting for pickup", { n: waiting.length })} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Section title={`${t("Waiting for pickup")} (${waiting.length})`}>
            {waiting.length === 0 ? (
              <Empty>{t("Nothing on the shelf.")}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {waiting.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {d.recipientName}
                        {d.packages > 1 && <span className="font-normal text-dim"> · {t("{n} packages", { n: d.packages })}</span>}
                      </div>
                      <div className="text-xs text-dim">
                        {[d.carrier, d.trackingNumber, d.description].filter(Boolean).join(" · ") || "—"}
                      </div>
                      <div className="text-xs text-dim">
                        {fmtRelative(d.receivedAt, locale)}
                        {d.storageSpot && <> · {t("stored at")} <span className="font-medium text-fg">{d.storageSpot}</span></>}
                        {!d.recipientId && ` · ${t("recipient has no account (tell them directly)")}`}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <form action={markCollected.bind(null, d.id)} className="flex gap-2">
                        <input name="collectedBy" placeholder={t("Collected by")} className="input w-36" />
                        <button className="btn btn-primary">
                          <Check className="size-4" /> {t("Collected")}
                        </button>
                      </form>
                      <form action={markReturned.bind(null, d.id)}>
                        <button className="btn" title={t("Returned to sender")}>
                          {t("Return")}
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={t("Recently collected")}>
            {done.length === 0 ? (
              <Empty>{t("No collected deliveries yet.")}</Empty>
            ) : (
              <TableWrap>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("Recipient")}</th>
                      <th>{t("Carrier")}</th>
                      <th>{t("Arrived")}</th>
                      <th>{t("Status")}</th>
                      <th>{t("Picked up by")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {done.map((d) => (
                      <tr key={d.id}>
                        <td>{d.recipientName}</td>
                        <td className="text-dim">{d.carrier ?? "—"}</td>
                        <td className="whitespace-nowrap text-dim">{fmtDateTime(d.receivedAt, locale)}</td>
                        <td>
                          <Badge value={d.status} />
                        </td>
                        <td className="text-dim">
                          {d.collectedBy ?? "—"}
                          <div className="text-xs">{fmtDateTime(d.collectedAt, locale)}</div>
                        </td>
                        <td>
                          <form action={undoCollected.bind(null, d.id)}>
                            <button className="btn px-2" title={t("Undo — put back on the shelf")}>
                              <Undo2 className="size-4" />
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Section>
        </div>

        <Section title={t("Log a delivery")} className="self-start">
          <form action={logDelivery} className="grid gap-3 p-4">
            <Field label={t("Recipient")}>
              <select name="recipientId" className="input">
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("…or recipient name (no account / department)")}>
              <input name="recipientName" className="input" />
            </Field>
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <Field label={t("Carrier")}>
                <input name="carrier" list="carriers" className="input" />
                <datalist id="carriers">
                  {CARRIERS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label={t("Packages")}>
                <input name="packages" type="number" min={1} defaultValue={1} className="input" />
              </Field>
            </div>
            <Field label={t("Tracking number")}>
              <input name="trackingNumber" className="input" />
            </Field>
            <Field label={t("Description")}>
              <input name="description" placeholder={t("e.g. large box, envelope, pallet")} className="input" />
            </Field>
            <Field label={t("Stored at")}>
              <input name="storageSpot" placeholder={t("e.g. Shelf B, mail room")} className="input" />
            </Field>
            <button className="btn btn-primary">{t("Log delivery")}</button>
          </form>
        </Section>
      </div>
    </>
  );
}
