import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { requireEnv } from "./config";

// Rows come back as plain objects; each query names the columns it needs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

let client: NeonQueryFunction<false, false> | null = null;

/** Tagged-template SQL. Values are always sent as parameters, never pasted into the query. */
export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  if (!client) client = neon(requireEnv("DATABASE_URL"));
  return client(strings, ...values) as Promise<Row[]>;
}

export type User = {
  id: string;
  email: string;
  display_name: string | null;
  stripe_customer_id: string | null;
  sub_status: string | null;
  sub_plan: string | null;
  sub_period_end: string | null;
  is_creator: boolean;
  stripe_account_id: string | null;
  payouts_enabled: boolean;
  license_version: string | null;
};

export type Video = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  ai_tools: string;
  status: "uploading" | "processing" | "pending_review" | "published" | "removed";
  mux_playback_id: string | null;
  duration_seconds: string | null;
  published_at: string | null;
  created_at: string;
};

/** First day of the month (UTC) for a date, as YYYY-MM-01. */
export function monthKey(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
