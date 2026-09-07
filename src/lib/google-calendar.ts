import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth credentials not set in .env");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthUrl(): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function handleGoogleOAuthCallback(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data: profile } = await oauth2.userinfo.get();

  const existing = await prisma.calendarIntegration.findFirst({ where: { provider: "google" } });

  const record = {
    provider: "google",
    connectedEmail: profile.email ?? undefined,
    accessToken: tokens.access_token ? encryptSecret(tokens.access_token) : undefined,
    refreshToken: tokens.refresh_token
      ? encryptSecret(tokens.refresh_token)
      : existing?.refreshToken ?? undefined,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
  };

  if (existing) {
    await prisma.calendarIntegration.update({ where: { id: existing.id }, data: record });
  } else {
    await prisma.calendarIntegration.create({ data: { ...record, calendarId: "primary" } });
  }
}

export async function isCalendarConnected(): Promise<{ connected: boolean; email?: string }> {
  const integration = await prisma.calendarIntegration.findFirst({ where: { provider: "google" } });
  if (!integration?.refreshToken) return { connected: false };
  return { connected: true, email: integration.connectedEmail ?? undefined };
}

export async function disconnectCalendar(): Promise<void> {
  await prisma.calendarIntegration.deleteMany({ where: { provider: "google" } });
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  attendees?: string[];
}

export async function fetchUpcomingEvents(maxResults = 20): Promise<CalendarEvent[]> {
  const integration = await prisma.calendarIntegration.findFirst({ where: { provider: "google" } });
  if (!integration?.refreshToken) {
    throw new Error("Calendar not connected");
  }

  const client = getOAuthClient();
  client.setCredentials({
    access_token: integration.accessToken ? decryptSecret(integration.accessToken) : undefined,
    refresh_token: decryptSecret(integration.refreshToken),
    expiry_date: integration.expiryDate?.getTime(),
  });

  client.on("tokens", async (tokens) => {
    const data: { accessToken?: string; expiryDate?: Date; refreshToken?: string } = {};
    if (tokens.access_token) data.accessToken = encryptSecret(tokens.access_token);
    if (tokens.expiry_date) data.expiryDate = new Date(tokens.expiry_date);
    if (tokens.refresh_token) data.refreshToken = encryptSecret(tokens.refresh_token);
    if (Object.keys(data).length) {
      await prisma.calendarIntegration.update({ where: { id: integration.id }, data });
    }
  });

  const calendar = google.calendar({ version: "v3", auth: client });
  const { data } = await calendar.events.list({
    calendarId: integration.calendarId || "primary",
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });

  return (data.items ?? []).map((event) => ({
    id: event.id ?? crypto.randomUUID(),
    title: event.summary ?? "(untitled)",
    start: event.start?.dateTime ?? event.start?.date ?? "",
    end: event.end?.dateTime ?? event.end?.date ?? "",
    allDay: !event.start?.dateTime,
    location: event.location ?? undefined,
    attendees: event.attendees?.map((a) => a.email ?? "").filter(Boolean),
  }));
}
