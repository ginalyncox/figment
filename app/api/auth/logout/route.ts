import { sessionCookieName } from "@/lib/auth";
import { seeOther } from "@/lib/http";

export async function POST() {
  const response = seeOther("/");
  response.cookies.delete(sessionCookieName);
  return response;
}
