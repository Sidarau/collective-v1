import { NextResponse } from "next/server";
import { confirmEmailChange } from "@core/email-change";

/**
 * The NEW address lands here from the verification email. Only now does the
 * account's sign-in address change — with the audit row and the session
 * invalidation (token_version bump) that forces a fresh sign-in everywhere.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await confirmEmailChange(url.searchParams.get("token"));

  const login = new URL("/login", url.origin);
  if (result.ok) {
    login.searchParams.set("emailChanged", "1");
  } else {
    login.searchParams.set(
      "error",
      result.reason === "email_in_use" ? "email_in_use" : "link_invalid",
    );
  }
  // 302 + no cookie work: the old sessions die via token_version, and the
  // operator signs in fresh with the new address.
  return NextResponse.redirect(login, 302);
}
