import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "helpdesk_session";
export const OAUTH_STATE_COOKIE = "helpdesk_oauth_state";
const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof loadUser>>>;

const withMemberships = { memberships: { include: { department: true } } } as const;

async function loadUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token
    ? await prisma.session.findUnique({ where: { id: hashToken(token) }, include: { user: { include: withMemberships } } })
    : null;
  const user = session && session.expiresAt >= new Date() ? session.user : signInRequired() ? null : await sharedUser();
  if (!user) return null;
  return {
    ...user,
    isAdmin: user.role === "admin",
    departmentIds: user.memberships.map((m) => m.departmentId),
    departmentSlugs: user.memberships.map((m) => m.department.slug),
  };
}

/** The signed-in user, or null. Memoized per request. */
export const getUser = cache(loadUser);

/** The signed-in user; redirects to /login otherwise. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

// ----------------------------------------------------------- permissions

export const isAgent = (u: CurrentUser) => u.isAdmin || u.departmentIds.length > 0;

export const isAgentOf = (u: CurrentUser, departmentId: string) =>
  u.isAdmin || u.departmentIds.includes(departmentId);

export const isReception = (u: CurrentUser) => u.isAdmin || u.departmentSlugs.includes("reception");

export function assert(condition: unknown, message = "You don't have permission to do that."): asserts condition {
  if (!condition) throw new Error(message);
}

// --------------------------------------------------------------- sign-in

/**
 * Sign-in is off until GOOGLE_SIGNIN="on" (that needs the Google OAuth client
 * and HTTPS). Until then everyone uses the app as one shared admin account.
 */
export const signInRequired = () => process.env.GOOGLE_SIGNIN === "on";

const SHARED_EMAIL = "staff@tasis.local";

/** The account everyone uses while sign-in is off. */
const sharedUser = () =>
  prisma.user.upsert({
    where: { email: SHARED_EMAIL },
    update: {},
    create: { email: SHARED_EMAIL, name: "TASIS staff", role: "admin" },
    include: withMemberships,
  });

// --------------------------------------------------------------- sessions

/** Creates or updates the user from a verified Google profile and starts a session. */
export async function signIn(profile: { email: string; name: string; image?: string | null }) {
  const email = profile.email.toLowerCase();
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name: profile.name, image: profile.image ?? null, lastLoginAt: new Date() },
    create: {
      email,
      name: profile.name,
      image: profile.image ?? null,
      role: adminEmails.includes(email) ? "admin" : "user",
      lastLoginAt: new Date(),
    },
  });
  // ADMIN_EMAILS also promotes people who signed in before being listed.
  if (adminEmails.includes(email) && user.role !== "admin") {
    await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { id: hashToken(token), userId: user.id, expiresAt } });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    expires: expiresAt,
  });
}

export async function signOut() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}
