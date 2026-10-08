import Link from "next/link";
import { LogIn, LogOut, X } from "lucide-react";
import { Badge, Empty, Field, PageHeader, Section, TableWrap } from "@/components/ui";
import { isReception, requireUser } from "@/lib/auth";
import { fmtDateTime, fmtTime, startOfToday, toLocalInput } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { cancelVisitor, checkInVisitor, checkOutVisitor, preRegisterVisitor, walkInVisitor } from "./actions";

type HostOption = { id: string; name: string };

function VisitorFields({ hosts }: { hosts: HostOption[] }) {
  return (
    <>
      <Field label="Visitor name">
        <input name="name" required className="input" />
      </Field>
      <Field label="Company / organisation">
        <input name="company" className="input" />
      </Field>
      <Field label="Email">
        <input name="email" type="email" className="input" />
      </Field>
      <Field label="Phone">
        <input name="phone" type="tel" className="input" />
      </Field>
      <Field label="Visiting (staff member)">
        <select name="hostId" className="input">
          <option value="">—</option>
          {hosts.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="…or host name (if not in the list)">
        <input name="hostName" className="input" />
      </Field>
      <Field label="Purpose of visit" className="sm:col-span-2">
        <input name="purpose" placeholder="Meeting, interview, contractor, parent visit…" className="input" />
      </Field>
    </>
  );
}

export default async function VisitorsPage() {
  const user = await requireUser();
  const reception = isReception(user);
  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const hosts = await prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const include = { host: true, createdBy: true } as const;

  if (!reception) {
    const mine = await prisma.visitor.findMany({
      where: { OR: [{ hostId: user.id }, { createdById: user.id }] },
      include,
      orderBy: [{ expectedAt: "desc" }, { createdAt: "desc" }],
      take: 50,
    });
    return (
      <>
        <PageHeader title="Visitors" subtitle="Let reception know who is coming to see you" />
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Section title="Pre-register a visitor">
            <form action={preRegisterVisitor} className="grid gap-3 p-4 sm:grid-cols-2">
              <VisitorFields hosts={hosts} />
              <Field label="Expected arrival">
                <input name="expectedAt" type="datetime-local" required defaultValue={toLocalInput(new Date())} className="input" />
              </Field>
              <div className="flex items-end">
                <button className="btn btn-primary">Register</button>
              </div>
            </form>
          </Section>
          <Section title="My visitors">
            {mine.length === 0 ? (
              <Empty>No visitors yet.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {mine.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {v.name} {v.company && <span className="font-normal text-dim">· {v.company}</span>}
                      </div>
                      <div className="text-xs text-dim">
                        {v.checkedInAt ? `Arrived ${fmtDateTime(v.checkedInAt)}` : `Expected ${fmtDateTime(v.expectedAt)}`}
                        {v.checkedOutAt && ` · left ${fmtTime(v.checkedOutAt)}`}
                      </div>
                    </div>
                    {!v.checkedInAt ? (
                      <form action={cancelVisitor.bind(null, v.id)}>
                        <button className="btn px-2" title="Cancel">
                          <X className="size-4" />
                        </button>
                      </form>
                    ) : (
                      <Badge value={v.checkedOutAt ? "closed" : "resolved"}>{v.checkedOutAt ? "Left" : "On site"}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </>
    );
  }

  const [onSite, expected, recent] = await Promise.all([
    prisma.visitor.findMany({ where: { checkedInAt: { not: null }, checkedOutAt: null }, include, orderBy: { checkedInAt: "asc" } }),
    prisma.visitor.findMany({
      where: { checkedInAt: null, expectedAt: { gte: today, lt: tomorrow } },
      include,
      orderBy: { expectedAt: "asc" },
    }),
    prisma.visitor.findMany({
      where: { checkedOutAt: { not: null } },
      include,
      orderBy: { checkedOutAt: "desc" },
      take: 30,
    }),
  ]);

  const hostOf = (v: (typeof onSite)[number]) => v.host?.name ?? v.hostName ?? "—";

  return (
    <>
      <PageHeader title="Visitors" subtitle={`${onSite.length} on site now · ${expected.length} still expected today`} />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Section title={`On site now (${onSite.length})`}>
            {onSite.length === 0 ? (
              <Empty>Nobody is signed in.</Empty>
            ) : (
              <TableWrap>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Visitor</th>
                      <th>Visiting</th>
                      <th>Badge</th>
                      <th>Since</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {onSite.map((v) => (
                      <tr key={v.id}>
                        <td>
                          <div className="font-medium">{v.name}</div>
                          <div className="text-xs text-dim">{[v.company, v.purpose].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td>{hostOf(v)}</td>
                        <td className="tabular-nums">{v.badgeNumber ?? "—"}</td>
                        <td className="text-dim">{fmtTime(v.checkedInAt)}</td>
                        <td className="text-right whitespace-nowrap">
                          <Link href={`/visitors/${v.id}/badge`} className="btn mr-2">
                            Badge
                          </Link>
                          <form action={checkOutVisitor.bind(null, v.id)} className="inline">
                            <button className="btn">
                              <LogOut className="size-4" /> Check out
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

          <Section title={`Expected today (${expected.length})`}>
            {expected.length === 0 ? (
              <Empty>No more pre-registered visitors today.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {expected.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {fmtTime(v.expectedAt)} · {v.name} {v.company && <span className="font-normal text-dim">({v.company})</span>}
                      </div>
                      <div className="text-xs text-dim">
                        Visiting {hostOf(v)}
                        {v.purpose && ` · ${v.purpose}`} · registered by {v.createdBy.name}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <form action={checkInVisitor.bind(null, v.id)} className="flex gap-2">
                        <input name="badgeNumber" placeholder="Badge #" className="input w-24" />
                        <button className="btn btn-primary">
                          <LogIn className="size-4" /> Check in
                        </button>
                      </form>
                      <form action={cancelVisitor.bind(null, v.id)}>
                        <button className="btn px-2" title="Remove">
                          <X className="size-4" />
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recently left">
            {recent.length === 0 ? (
              <Empty>No visits logged yet.</Empty>
            ) : (
              <TableWrap>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Visitor</th>
                      <th>Visiting</th>
                      <th>In</th>
                      <th>Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((v) => (
                      <tr key={v.id}>
                        <td>
                          {v.name} {v.company && <span className="text-dim">· {v.company}</span>}
                        </td>
                        <td className="text-dim">{hostOf(v)}</td>
                        <td className="whitespace-nowrap text-dim">{fmtDateTime(v.checkedInAt)}</td>
                        <td className="whitespace-nowrap text-dim">{fmtTime(v.checkedOutAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Section>
        </div>

        <aside className="space-y-6">
          <Section title="Walk-in check-in">
            <form action={walkInVisitor} className="grid gap-3 p-4">
              <VisitorFields hosts={hosts} />
              <Field label="Badge number">
                <input name="badgeNumber" className="input" />
              </Field>
              <div>
                <button className="btn btn-primary w-full">
                  <LogIn className="size-4" /> Check in
                </button>
              </div>
            </form>
          </Section>
          <Section title="Pre-register for another day">
            <form action={preRegisterVisitor} className="grid gap-3 p-4">
              <VisitorFields hosts={hosts} />
              <Field label="Expected arrival">
                <input name="expectedAt" type="datetime-local" required className="input" />
              </Field>
              <div>
                <button className="btn w-full">Register</button>
              </div>
            </form>
          </Section>
        </aside>
      </div>
    </>
  );
}
