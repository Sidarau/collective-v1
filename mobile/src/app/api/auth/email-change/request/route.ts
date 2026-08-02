import { NextResponse } from "next/server";
import { getOperatorPrincipal } from "@/lib/guard";
import { requestEmailChange } from "@core/email-change";

/**
 * Step 1 of the email-change flow, called from the account sheet. Session
 * required; the address is validated, rate-limited and both emails go out
 * before this returns.
 */
export async function POST(request: Request) {
  const principal = await getOperatorPrincipal();
  if (!principal) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  }

  let newEmail: unknown;
  try {
    newEmail = (await request.json())?.newEmail;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_email" }, { status: 400 });
  }
  if (typeof newEmail !== "string") {
    return NextResponse.json({ ok: false, reason: "invalid_email" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const result = await requestEmailChange(principal.id, principal.email, newEmail, ip);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
