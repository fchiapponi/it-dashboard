import { Empty, PageHeader, Section } from "@/components/ui";
import { PrinterButton } from "../inventory/PrinterButton";
import { requireUser } from "@/lib/auth";
import { getDiningData } from "@/lib/dining";
import { fmtDateTime } from "@/lib/format";
import { refreshDining } from "./actions";
import { DiningDashboard } from "./DiningDashboard";

export default async function DiningPage() {
  await requireUser();
  const data = await getDiningData();

  return (
    <>
      <PageHeader
        title="Dining"
        subtitle={
          data.fetchedAt
            ? `Meals served in De Nobili, Hadsall and Focolare · sheet read ${fmtDateTime(new Date(data.fetchedAt))}`
            : "Meals served in De Nobili, Hadsall and Focolare"
        }
        actions={data.configured && <PrinterButton action={refreshDining}>Refresh now</PrinterButton>}
      />
      {data.error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          Couldn&apos;t read the kitchen sheet: {data.error}
          {data.days.length > 0 && " The figures below are from the last successful read."}
        </div>
      )}
      {!data.configured ? (
        <Section>
          <Empty>
            No meal sheet is connected. Set <code>DINING_SHEET_ID</code> in <code>.env</code> to the ID of the kitchen&apos;s Google Sheet and restart
            the app.
          </Empty>
        </Section>
      ) : data.days.length === 0 ? (
        !data.error && (
          <Section>
            <Empty>The kitchen sheet has no meal counts yet.</Empty>
          </Section>
        )
      ) : (
        <DiningDashboard days={data.days} />
      )}
    </>
  );
}
