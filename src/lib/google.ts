import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

// Access tokens for the Google service account in GOOGLE_SERVICE_ACCOUNT_FILE.
// With `subject` the account acts as that Workspace user through domain-wide
// delegation, which is how it reads and answers the ticket@ mailbox.

type ServiceAccount = { client_email: string; private_key: string };

const tokens = new Map<string, { value: string; expiresAt: number }>();

export const serviceAccountFile = () => process.env.GOOGLE_SERVICE_ACCOUNT_FILE ?? "";

export async function googleToken(scope: string, subject?: string) {
  const key = `${scope} ${subject ?? ""}`;
  const cached = tokens.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;

  const sa = JSON.parse(readFileSync(serviceAccountFile(), "utf8")) as ServiceAccount;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    ...(subject ? { sub: subject } : {}),
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Google auth failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokens.set(key, { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 });
  return json.access_token;
}
