import { Empty, PageHeader, Section } from "@/components/ui";
import { PrinterButton } from "../inventory/PrinterButton";
import { requireUser } from "@/lib/auth";
import { getDiningData } from "@/lib/dining";
import { fmtDateTime } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import { refreshDining } from "./actions";
import { DiningDashboard } from "./DiningDashboard";

export default async function DiningPage() {
  await requireUser();
  const data = await getDiningData();
  const { t, locale } = await getI18n();

  return (
    <>
      <PageHeader
        title={t("Dining")}
        subtitle={
          data.fetchedAt
            ? `${t("Meals served in De Nobili, Hadsall and Focolare")} · ${t("sheet read {when}", { when: fmtDateTime(new Date(data.fetchedAt), locale) })}`
            : t("Meals served in De Nobili, Hadsall and Focolare")
        }
        actions={data.configured && <PrinterButton action={refreshDining}>{t("Refresh now")}</PrinterButton>}
      />
      {data.error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {t("Couldn't read the kitchen sheet: {error}", { error: data.error })}
          {data.days.length > 0 && ` ${t("The figures below are from the last successful read.")}`}
        </div>
      )}
      {!data.configured ? (
        <Section>
          <Empty>
            {t("No meal sheet is connected. Set {variable} in {file} to the ID of the kitchen's Google Sheet and restart the app.", {
              variable: "DINING_SHEET_ID",
              file: ".env",
            })}
          </Empty>
        </Section>
      ) : data.days.length === 0 ? (
        !data.error && (
          <Section>
            <Empty>{t("The kitchen sheet has no meal counts yet.")}</Empty>
          </Section>
        )
      ) : (
        <DiningDashboard days={data.days} />
      )}
    </>
  );
}
