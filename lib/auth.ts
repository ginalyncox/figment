import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { config, requireEnv } from "./config";
import { sql, type User } from "./db";

// Sign-in is by emailed link (no passwords to store or leak).

const SESSION_COOKIE = "session";
export const ANON_COOKIE = "viewer";
export const VIEWER_HEADER = "x-viewer-key";

function secret() {
  return new TextEncoder().encode(requireEnv("AUTH_SECRET"));
}

export async function createLoginToken(email: string): Promise<string> {
  return new SignJWT({ email, purpose: "login" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret());
}

export async function readLoginToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose !== "login" || typeof payload.email !== "string") return null;
    return payload.email;
  } catch {
    return null;
  }
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ purpose: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
export const sessionCookieName = SESSION_COOKIE;

/** The signed-in user, or null. */
export async function currentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose !== "session" || !payload.sub) return null;
    const rows = await sql`select * from users where id = ${payload.sub}`;
    return (rows[0] as User) ?? null;
  } catch {
    return null;
  }
}

/** Key used to count free videos: the account if signed in, else the anonymous cookie. */
export async function viewerKey(user: User | null): Promise<string | null> {
  if (user) return `u:${user.id}`;
  const store = await cookies();
  const fromCookie = store.get(ANON_COOKIE)?.value;
  if (fromCookie) return `a:${fromCookie}`;
  // First visit: proxy.ts created the id on this same request and passed it in a header.
  const fromHeader = (await headers()).get(VIEWER_HEADER);
  return fromHeader ? `a:${fromHeader}` : null;
}

export function isAdmin(user: User | null): boolean {
  return !!user && config.adminEmails.includes(user.email.toLowerCase());
}

export function isSubscribed(user: User | null): boolean {
  if (!user) return false;
  if (user.sub_status !== "active" && user.sub_status !== "trialing") return false;
  if (!user.sub_period_end) return true;
  // One day of grace so a late webhook does not lock out a paying viewer.
  return new Date(user.sub_period_end).getTime() + 86_400_000 > Date.now();
}
