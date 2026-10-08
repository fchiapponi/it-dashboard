// Runs once when the server starts. Starts the ticket@ mailbox poller when
// Gmail is configured (see "Tickets by email" in the README), and re-reads
// the network printers (model, serial, toner levels) and the kitchen's
// meal-count sheet on a timer.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { refreshPrinters } = await import("@/lib/printers");
  const minutes = Math.max(5, Number(process.env.PRINTER_REFRESH_MINUTES) || 60);
  const refresh = () =>
    refreshPrinters()
      .then(({ total, failed }) => total && console.log(`[printers] read ${total - failed.length}/${total}${failed.length ? `, no answer: ${failed.join(", ")}` : ""}`))
      .catch((e) => console.error("[printers]", e));
  setInterval(refresh, minutes * 60 * 1000);
  void refresh();

  if (process.env.DINING_SHEET_ID) {
    const { diningRefreshMs, getDiningData } = await import("@/lib/dining");
    const read = () =>
      getDiningData(true)
        .then((d) => console.log(`[dining] ${d.error ? `read failed: ${d.error}` : `read ${d.days.length} days`}`))
        .catch((e) => console.error("[dining]", e));
    setInterval(read, diningRefreshMs());
    void read();
  }

  if (!process.env.TICKET_MAILBOX || !process.env.GOOGLE_SERVICE_ACCOUNT_FILE) return;
  const { pollTicketMailbox } = await import("@/lib/emailTickets");
  const seconds = Math.max(15, Number(process.env.EMAIL_POLL_SECONDS) || 60);
  setInterval(pollTicketMailbox, seconds * 1000);
  void pollTicketMailbox();
  console.log(`[email-tickets] watching ${process.env.TICKET_MAILBOX} every ${seconds}s`);
}
