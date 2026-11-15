import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Gives every visitor an anonymous id cookie, used only to count free videos.
// (Next.js 16 calls this file "proxy"; older versions called it "middleware".)

const ANON_COOKIE = "viewer";
const VIEWER_HEADER = "x-viewer-key";

export function proxy(request: NextRequest) {
  // Never trust this header from the outside.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(VIEWER_HEADER);

  if (request.cookies.get(ANON_COOKIE)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const id = crypto.randomUUID();
  requestHeaders.set(VIEWER_HEADER, id);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set(ANON_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)"],
};
