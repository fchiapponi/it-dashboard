import { Check, Undo2 } from "lucide-react";
import { Badge, Empty, Field, PageHeader, Section, TableWrap } from "@/components/ui";
import { isReception, requireUser } from "@/lib/auth";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { logDelivery, markCollected, markReturned, undoCollected } from "./actions";

const CARRIERS = ["Swiss Post", "DHL", "UPS", "FedEx", "DPD", "TNT", "Planzer", "Amazon", "Courier", "Hand delivered"];

export default async function DeliveriesPage() {
  const user = await requireUser();
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
          title="Deliveries"
          subtitle={waiting.length ? `${waiting.length} waiting for you at reception` : "Nothing waiting for you at reception"}
        />
        <Section>
          {mine.length === 0 ? (
            <Empty>No deliveries logged for you yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {mine.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {d.packages > 1 ? `${d.packages} packages` : "Package"}
                      {d.carrier && ` · ${d.carrier}`}
                      {d.description && <span className="font-normal text-dim"> — {d.description}</span>}
                    </div>
                    <div className="text-xs text-dim">
                      Arrived {fmtDateTime(d.receivedAt)}
                      {d.trackingNumber && ` · ${d.trackingNumber}`}
                      {d.status === "collected" && ` · collected ${fmtDateTime(d.collectedAt)}`}
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
      <PageHeader title="Deliveries" subtitle={`${waiting.length} waiting for pickup`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Section title={`Waiting for pickup (${waiting.length})`}>
            {waiting.length === 0 ? (
              <Empty>Nothing on the shelf.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {waiting.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {d.recipientName}
                        {d.packages > 1 && <span className="font-normal text-dim"> · {d.packages} packages</span>}
                      </div>
                      <div className="text-xs text-dim">
                        {[d.carrier, d.trackingNumber, d.description].filter(Boolean).join(" · ") || "—"}
                      </div>
                      <div className="text-xs text-dim">
                        {fmtRelative(d.receivedAt)}
                        {d.storageSpot && <> · stored at <span className="font-medium text-fg">{d.storageSpot}</span></>}
                        {!d.recipientId && " · recipient has no account (tell them directly)"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <form action={markCollected.bind(null, d.id)} className="flex gap-2">
                        <input name="collectedBy" placeholder="Collected by" className="input w-36" />
                        <button className="btn btn-primary">
                          <Check className="size-4" /> Collected
                        </button>
                      </form>
                      <form action={markReturned.bind(null, d.id)}>
                        <button className="btn" title="Returned to sender">
                          Return
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recently collected">
            {done.length === 0 ? (
              <Empty>No collected deliveries yet.</Empty>
            ) : (
              <TableWrap>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Recipient</th>
                      <th>Carrier</th>
                      <th>Arrived</th>
                      <th>Status</th>
                      <th>Picked up by</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {done.map((d) => (
                      <tr key={d.id}>
                        <td>{d.recipientName}</td>
                        <td className="text-dim">{d.carrier ?? "—"}</td>
                        <td className="whitespace-nowrap text-dim">{fmtDateTime(d.receivedAt)}</td>
                        <td>
                          <Badge value={d.status} />
                        </td>
                        <td className="text-dim">
                          {d.collectedBy ?? "—"}
                          <div className="text-xs">{fmtDateTime(d.collectedAt)}</div>
                        </td>
                        <td>
                          <form action={undoCollected.bind(null, d.id)}>
                            <button className="btn px-2" title="Undo — put back on the shelf">
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

        <Section title="Log a delivery" className="self-start">
          <form action={logDelivery} className="grid gap-3 p-4">
            <Field label="Recipient">
              <select name="recipientId" className="input">
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="…or recipient name (no account / department)">
              <input name="recipientName" className="input" />
            </Field>
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <Field label="Carrier">
                <input name="carrier" list="carriers" className="input" />
                <datalist id="carriers">
                  {CARRIERS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Packages">
                <input name="packages" type="number" min={1} defaultValue={1} className="input" />
              </Field>
            </div>
            <Field label="Tracking number">
              <input name="trackingNumber" className="input" />
            </Field>
            <Field label="Description">
              <input name="description" placeholder="e.g. large box, envelope, pallet" className="input" />
            </Field>
            <Field label="Stored at">
              <input name="storageSpot" placeholder="e.g. Shelf B, mail room" className="input" />
            </Field>
            <button className="btn btn-primary">Log delivery</button>
          </form>
        </Section>
      </div>
    </>
  );
}
