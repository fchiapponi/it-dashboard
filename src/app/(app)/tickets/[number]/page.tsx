import { TicketDetail } from "./TicketDetail";

export default async function TicketPage({ params }: PageProps<"/tickets/[number]">) {
  return <TicketDetail number={Number.parseInt((await params).number, 10)} />;
}
