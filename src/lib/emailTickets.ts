import { label } from "@/lib/format";
import { addLabel, getMessage, gmailConfigured, labelId, listPending, mailbox, reply, type InboundEmail } from "@/lib/gmail";
import { prisma } from "@/lib/prisma";
import { triageEmail } from "@/lib/ticketTriage";
import { createTicketRecord } from "@/lib/tickets";

// Turns emails sent to ticket@ into tickets. Every email the poller has dealt
// with gets the PROCESSED label in Gmail, so it is never handled twice and
// staff can still read the mailbox normally.
//   - a new email opens a ticket, sorted by AI, and the sender gets a confirmation;
//   - a reply in the thread of an existing ticket becomes a comment on it.

const PROCESSED = "helpdesk-processed";
const MAX_ATTEMPTS = 3;
const attempts = new Map<string, number>();

let running = false;

/** Handles every unprocessed email in the ticket@ inbox. Safe to call on a timer. */
export async function pollTicketMailbox() {
  if (!gmailConfigured() || running) return;
  running = true;
  try {
    const processed = await labelId(PROCESSED);
    for (const id of await listPending(PROCESSED)) {
      try {
        await handle(await getMessage(id));
        await addLabel(id, processed);
        attempts.delete(id);
      } catch (error) {
        const n = (attempts.get(id) ?? 0) + 1;
        attempts.set(id, n);
        console.error(`[email-tickets] message ${id} failed (attempt ${n}/${MAX_ATTEMPTS}):`, error);
        // Give up on an email that keeps failing, so it doesn't block the queue forever.
        if (n >= MAX_ATTEMPTS) {
          await addLabel(id, processed).catch(() => {});
          attempts.delete(id);
        }
      }
    }
  } catch (error) {
    console.error("[email-tickets] poll failed:", error);
  } finally {
    running = false;
  }
}

async function handle(email: InboundEmail) {
  if (isAutomated(email)) return;

  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN?.toLowerCase();
  if (!email.fromEmail || email.fromEmail === mailbox()) return;
  // Only school staff can open tickets. Outside senders get no answer, so
  // spam never gets a reply.
  if (domain && !email.fromEmail.endsWith(`@${domain}`)) return;
  // Drop mail Google flagged as forged.
  if (/dmarc=fail/i.test(email.header("Authentication-Results"))) return;

  const existing = await prisma.ticket.findUnique({ where: { emailThreadId: email.threadId } });
  if (existing) return addReply(existing, email);
  return openTicket(email);
}

/** Out-of-office replies, bounces and mailing lists. Answering them risks mail loops. */
function isAutomated(email: InboundEmail) {
  const auto = email.header("Auto-Submitted").toLowerCase();
  if (auto && auto !== "no") return true;
  if (/^(bulk|junk|list)$/i.test(email.header("Precedence"))) return true;
  if (email.header("List-Id") || email.header("X-Autoreply") || email.header("X-Autorespond")) return true;
  return /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply)@/i.test(email.fromEmail);
}

async function findOrCreateUser(email: InboundEmail) {
  const name = email.fromName || email.fromEmail.split("@")[0];
  return prisma.user.upsert({ where: { email: email.fromEmail }, update: {}, create: { email: email.fromEmail, name } });
}

async function openTicket(email: InboundEmail) {
  const text = stripQuoted(email.text);
  if (!text && !email.subject) return;

  const requester = await findOrCreateUser(email);
  const triage = await triageEmail({ subject: email.subject, text, fromName: requester.name });
  const note = email.attachments
    ? `\n\n(${email.attachments} attachment${email.attachments > 1 ? "s" : ""} in the original email, not imported. Ask the requester if you need them.)`
    : "";

  const ticket = await prisma.$transaction(async (tx) => {
    const t = await createTicketRecord(
      {
        title: triage.title,
        description: (text || email.subject) + note,
        priority: triage.priority,
        departmentId: triage.departmentId,
        categoryId: triage.categoryId,
        locationId: triage.locationId,
        requesterId: requester.id,
        emailThreadId: email.threadId,
      },
      tx,
    );
    await tx.ticketActivity.create({
      data: {
        ticketId: t.id,
        kind: "event",
        body: triage.fallback
          ? `sent by email to ${mailbox()}. The AI couldn't sort it, so check the department and category.`
          : `sent by email to ${mailbox()} and sorted by AI`,
      },
    });
    return t;
  });

  // The ticket exists from here on, so a failed confirmation must not make the
  // poller retry this email: the retry would file it as a reply to its own ticket.
  await sendConfirmation(email, ticket.id, requester.name).catch((error) =>
    console.error(`[email-tickets] ticket #${ticket.number} created, but the confirmation email failed:`, error),
  );
}

async function sendConfirmation(email: InboundEmail, ticketId: string, name: string) {
  const full = await prisma.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { department: true, category: true, location: true },
  });
  const appUrl = process.env.APP_URL ?? "";
  await reply(
    email,
    `[Ticket #${full.number}] ${full.title}`,
    [
      `Hello ${name},`,
      "",
      `Thank you for your request. We have opened ticket #${full.number} for it.`,
      "",
      `  Title:       ${full.title}`,
      `  Department:  ${full.department.name}${full.category ? ` · ${full.category.name}` : ""}`,
      ...(full.location ? [`  Location:    ${full.location.name}`] : []),
      `  Priority:    ${label(full.priority)}`,
      "",
      `Follow it here: ${appUrl}/tickets/${full.number}`,
      "",
      "To add details, just reply to this email. Your reply will be added to the ticket.",
      "",
      "TASIS Helpdesk",
    ].join("\n"),
  );
}

async function addReply(ticket: { id: string; requesterId: string; departmentId: string; status: string }, email: InboundEmail) {
  const body = stripQuoted(email.text);
  if (!body) return;

  const author = await findOrCreateUser(email);
  const isRequester = author.id === ticket.requesterId;
  const isAgent =
    author.role === "admin" ||
    (await prisma.membership.count({ where: { userId: author.id, departmentId: ticket.departmentId } })) > 0;
  // Someone else on CC can't write into a ticket they can't see.
  if (!isRequester && !isAgent) return;

  await prisma.ticketActivity.create({ data: { ticketId: ticket.id, authorId: author.id, kind: "comment", body } });
  await prisma.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } });

  // Same rule as replying in the app: a requester's reply puts a resolved or waiting ticket back in the queue.
  if (isRequester && !isAgent && ["resolved", "waiting"].includes(ticket.status)) {
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "open", resolvedAt: null } });
    await prisma.ticketActivity.create({
      data: { ticketId: ticket.id, authorId: author.id, kind: "event", body: "reopened by email reply" },
    });
  }
}

/** Drops the quoted history mail clients append below a reply, plus the signature delimiter. */
function stripQuoted(text: string) {
  const lines = text.split("\n");
  const cut = lines.findIndex(
    (l, i) =>
      /^(On|Il|Am|Le) .+(wrote|scritto|schrieb|écrit)\s*:\s*$/i.test(l.trim()) ||
      /^-{2,}\s*(Original Message|Forwarded message|Messaggio originale)/i.test(l.trim()) ||
      // Outlook-style header block: "From: …" followed by "Sent:" / "To:" lines
      (/^(From|Da|Von|De): /.test(l) && lines.slice(i + 1, i + 4).some((n) => /^(Sent|Date|To|Subject|Inviato|Gesendet|Envoyé):/.test(n))) ||
      l.trim() === "--",
  );
  return (cut === -1 ? lines : lines.slice(0, cut))
    .filter((l) => !l.startsWith(">"))
    .join("\n")
    .trim();
}
