// All settings in one place. Values come from environment variables (.env.local).

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  siteName: process.env.NEXT_PUBLIC_SITE_NAME || "Figment",
  // On Vercel the address is filled in automatically if NEXT_PUBLIC_SITE_URL is not set.
  siteUrl: (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
  ).replace(/\/$/, ""),

  /** How many videos a viewer can watch before the paywall. */
  freeVideoLimit: int("FREE_VIDEO_LIMIT", 3),

  /** Your service fee, in basis points. 2000 = 20% of net subscription revenue. */
  platformFeeBps: int("PLATFORM_FEE_BPS", 2000),

  /** Version label saved when a creator accepts the Creator License Agreement. */
  licenseVersion: process.env.CREATOR_LICENSE_VERSION || "draft-2026-11-14",

  adminEmails: (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),

  legalOwner: "Gina Makes LLC",
  copyrightLine: "© 2026 Gina Makes LLC",
};

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
