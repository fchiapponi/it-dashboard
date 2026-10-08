import { googleToken, serviceAccountFile } from "@/lib/google";

// Minimal Gmail API client for the ticket@ mailbox. The service account acts as
// the mailbox through domain-wide delegation, so no user has to stay logged in.

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const SCOPE = "https://www.googleapis.com/auth/gmail.modify";

export const mailbox = () => process.env.TICKET_MAILBOX?.trim().toLowerCase() ?? "";

export const gmailConfigured = () => Boolean(mailbox() && serviceAccountFile());

async function gmail<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${await googleToken(SCOPE, mailbox())}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) throw new Error(`Gmail ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------- labels

/** Id of the label with this name, created on first use. */
export async function labelId(name: string) {
  const { labels = [] } = await gmail<{ labels?: { id: string; name: string }[] }>("/labels");
  const found = labels.find((l) => l.name === name);
  if (found) return found.id;
  const created = await gmail<{ id: string }>("/labels", {
    method: "POST",
    body: { name, labelListVisibility: "labelShow", messageListVisibility: "show" },
  });
  return created.id;
}

export function addLabel(messageId: string, id: string) {
  return gmail(`/messages/${messageId}/modify`, { method: "POST", body: { addLabelIds: [id] } });
}

// -------------------------------------------------------------- messages

type Part = {
  mimeType: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; attachmentId?: string };
  parts?: Part[];
};

export type InboundEmail = {
  id: string;
  threadId: string;
  header: (name: string) => string;
  fromEmail: string;
  fromName: string;
  subject: string;
  text: string;
  attachments: number;
};

/** Ids of inbox messages that don't carry `label` yet, oldest first. */
export async function listPending(label: string) {
  const q = encodeURIComponent(`in:inbox -label:${label} -from:${mailbox()}`);
  const { messages = [] } = await gmail<{ messages?: { id: string }[] }>(`/messages?q=${q}&maxResults=25`);
  return messages.map((m) => m.id).reverse();
}

export async function getMessage(id: string): Promise<InboundEmail> {
  const msg = await gmail<{ id: string; threadId: string; payload: Part }>(`/messages/${id}?format=full`);
  const headers = msg.payload.headers ?? [];
  const header = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  const from = parseAddress(header("From"));
  const all = flatten(msg.payload);
  const decode = (p?: Part) => (p?.body?.data ? Buffer.from(p.body.data, "base64url").toString("utf8") : "");
  const plain = decode(all.find((p) => p.mimeType === "text/plain" && !p.filename));
  const html = decode(all.find((p) => p.mimeType === "text/html" && !p.filename));

  return {
    id: msg.id,
    threadId: msg.threadId,
    header,
    fromEmail: from.email,
    fromName: from.name,
    subject: header("Subject").trim(),
    text: (plain || htmlToText(html)).replace(/\r\n/g, "\n").trim(),
    attachments: all.filter((p) => p.filename && p.body?.attachmentId).length,
  };
}

function flatten(part: Part): Part[] {
  return [part, ...(part.parts ?? []).flatMap(flatten)];
}

function parseAddress(value: string) {
  const m = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const email = (m ? m[2] : value).trim().toLowerCase();
  return { email, name: m?.[1].trim() || "" };
}

function htmlToText(html: string) {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n");
}

/** Sends a plain-text reply in the same Gmail thread as `to`. */
export async function reply(to: InboundEmail, subject: string, body: string) {
  const messageId = to.header("Message-ID");
  const references = [to.header("References"), messageId].filter(Boolean).join(" ");
  const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`);

  const raw = [
    `From: ${encodeHeader(process.env.TICKET_MAILBOX_NAME ?? "TASIS Helpdesk")} <${mailbox()}>`,
    `To: ${to.fromEmail}`,
    `Subject: ${encodeHeader(subject)}`,
    ...(messageId ? [`In-Reply-To: ${messageId}`, `References: ${references}`] : []),
    "Auto-Submitted: auto-replied",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body).toString("base64"),
  ].join("\r\n");

  await gmail("/messages/send", {
    method: "POST",
    body: { raw: Buffer.from(raw).toString("base64url"), threadId: to.threadId },
  });
}
