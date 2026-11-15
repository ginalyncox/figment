import { NextResponse } from "next/server";
import { config } from "./config";

/** Redirect after a form post (303 turns the POST into a GET). */
export function seeOther(path: string): NextResponse {
  return NextResponse.redirect(new URL(path, config.siteUrl), 303);
}

/** Only allow redirects back into this site (blocks "open redirect" tricks). */
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = "/account"): string {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") ? s : fallback;
}

export function text(form: FormData, name: string, max = 5000): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
