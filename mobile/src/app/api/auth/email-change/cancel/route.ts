import { NextResponse } from "next/server";
import { cancelEmailChange } from "@core/email-change";

/**
 * The OLD address stops a change it didn't ask for. Always lands on a calm
 * confirmation screen — never reveals whether the token matched.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  await cancelEmailChange(url.searchParams.get("token"));
  const login = new URL("/login", url.origin);
  login.searchParams.set("changeStopped", "1");
  return NextResponse.redirect(login, 302);
}
