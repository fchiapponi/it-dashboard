import Link from "next/link";
import { Empty, PageHeader, Section, TableWrap } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { getKitchenInventory, HALLS, type HallQuantity, type KitchenArticle } from "@/lib/kitchenInventory";
import { cn } from "@/lib/utils";
import { INTL } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { refreshKitchenInventory } from "./actions";
import { PrinterButton } from "./PrinterButton";

/**
 * The kitchen's inventory: the articles of its Google Sheet, one list per tab,
 * with how many of each De Nobili, Hadsall and Focolare use. Edited in the
 * sheet, not here.
 */
export async function KitchenInventory({ dept, sp }: { dept: { slug: string; name: string }; sp: Record<string, string | string[] | undefined> }) {
  const data = await getKitchenInventory();
  const { t, locale } = await getI18n();
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const category = data.categories.find((c) => c.name === sp.cat) ?? data.categories[0];
  const href = (cat: string, search = "") => `/inventory?dept=${dept.slug}&cat=${encodeURIComponent(cat)}${search ? `&q=${encodeURIComponent(search)}` : ""}`;

  const needle = q.toLowerCase();
  const articles = (category?.articles ?? []).filter(
    (a) => !needle || [a.name, ...a.extra, ...Object.values(a.halls)].some((v) => v !== null && String(v).toLowerCase().includes(needle)),
  );
  const num = (n: number) => n.toLocaleString(INTL[locale]);
  const count = (v: HallQuantity) => (typeof v === "number" ? v : 0);
  const total = (a: KitchenArticle) => HALLS.reduce((n, h) => n + count(a.halls[h.id]), 0);

  return (
    <>
      <PageHeader
        title={t("{dept} inventory", { dept: dept.name })}
        subtitle={
          data.fetchedAt
            ? `${t("Articles used in De Nobili, Hadsall and Focolare")} · ${t("sheet read {when}", { when: fmtDateTime(new Date(data.fetchedAt), locale) })}`
            : t("Articles used in De Nobili, Hadsall and Focolare")
        }
        actions={data.configured && <PrinterButton action={refreshKitchenInventory}>{t("Refresh now")}</PrinterButton>}
      />
      {data.error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {t("Couldn't read the kitchen sheet: {error}", { error: data.error })}
          {data.categories.length > 0 && ` ${t("The figures below are from the last successful read.")}`}
        </div>
      )}
      {!data.configured ? (
        <Section>
          <Empty>
            {t("No inventory sheet is connected. Set {variable} in {file} to the ID of the kitchen's Google Sheet and restart the app.", {
              variable: "KITCHEN_INVENTORY_SHEET_ID",
              file: ".env",
            })}
          </Empty>
        </Section>
      ) : !category ? (
        !data.error && (
          <Section>
            <Empty>{t("The kitchen sheet has no articles yet.")}</Empty>
          </Section>
        )
      ) : (
        <>
          {/* One list per tab of the sheet. */}
          <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-line pb-3">
            {data.categories.map((c) => (
              <Link
                key={c.name}
                href={href(c.name)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm",
                  c === category ? "bg-accent font-medium text-white shadow-sm" : "text-dim hover:bg-panel hover:text-fg",
                )}
              >
                {c.name}
                <span className={cn("ml-1.5 text-xs", c === category ? "text-white/80" : "text-dim")}>{c.articles.length}</span>
              </Link>
            ))}
          </div>

          <form className="mb-4 flex flex-wrap gap-2" action="/inventory">
            <input type="hidden" name="dept" value={dept.slug} />
            <input type="hidden" name="cat" value={category.name} />
            <input name="q" defaultValue={q} placeholder={t("Search {type}…", { type: category.name })} className="input max-w-sm" />
          </form>

          <Section title={t(articles.length === 1 ? "{n} article" : "{n} articles", { n: articles.length })}>
            {articles.length === 0 ? (
              <Empty>{q ? t("Nothing matches.") : t("This tab has no articles.")}</Empty>
            ) : (
              <TableWrap>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("Article")}</th>
                      {category.columns.map((c, i) => (
                        <th key={i}>{c}</th>
                      ))}
                      {HALLS.map((h) => (
                        <th key={h.id} className="text-right">
                          {h.name}
                        </th>
                      ))}
                      <th className="text-right">{t("Total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articles.map((a, i) => (
                      <tr key={i} className="hover:bg-panel-muted">
                        <td className="font-medium">{a.name}</td>
                        {a.extra.map((v, j) => (
                          <td key={j} className="text-dim">
                            {v || "—"}
                          </td>
                        ))}
                        {HALLS.map((h) => {
                          const v = a.halls[h.id];
                          return (
                            <td key={h.id} className={cn("text-right tabular-nums", (v === null || v === 0) && "text-dim")}>
                              {v === null ? "—" : typeof v === "number" ? num(v) : v}
                            </td>
                          );
                        })}
                        <td className="text-right font-semibold tabular-nums">{num(total(a))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line font-semibold">
                      <td colSpan={1 + category.columns.length}>{t("Total")}</td>
                      {HALLS.map((h) => (
                        <td key={h.id} className="text-right tabular-nums">
                          {num(articles.reduce((n, a) => n + count(a.halls[h.id]), 0))}
                        </td>
                      ))}
                      <td className="text-right tabular-nums">{num(articles.reduce((n, a) => n + total(a), 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </TableWrap>
            )}
          </Section>
        </>
      )}
    </>
  );
}
