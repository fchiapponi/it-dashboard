// Runs once when the server starts. Starts the ticket@ mailbox poller when
// Gmail is configured (see "Tickets by email" in the README).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.TICKET_MAILBOX || !process.env.GOOGLE_SERVICE_ACCOUNT_FILE) return;

  const { pollTicketMailbox } = await import("@/lib/emailTickets");
  const seconds = Math.max(15, Number(process.env.EMAIL_POLL_SECONDS) || 60);
  setInterval(pollTicketMailbox, seconds * 1000);
  void pollTicketMailbox();
  console.log(`[email-tickets] watching ${process.env.TICKET_MAILBOX} every ${seconds}s`);
}
