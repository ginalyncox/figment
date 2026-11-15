import { createSessionToken, readLoginToken, sessionCookieName, sessionCookieOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { safeNext, seeOther } from "@/lib/http";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = await readLoginToken(url.searchParams.get("token") || "");
  if (!email) return seeOther("/login?status=expired");

  const rows = await sql`
    insert into users (email) values (${email})
    on conflict (email) do update set email = excluded.email
    returning id`;

  const response = seeOther(safeNext(url.searchParams.get("next")));
  response.cookies.set(sessionCookieName, await createSessionToken(rows[0].id), sessionCookieOptions);
  return response;
}
