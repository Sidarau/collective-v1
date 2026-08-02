import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next-path";
import { LoginForm } from "./LoginClient";

export const dynamic = "force-dynamic";

/**
 * The single operator login. Mobile (and any future *.opencollective.app
 * surface) bounces unauthenticated visitors here with ?next=<absolute url>.
 * Anyone already holding a valid operator session skips the form entirely
 * and continues to where they were headed.
 *
 * The check must require the operator role — not merely "a session exists":
 * a stale cookie that predates role claims passes a bare session check here
 * but fails the mobile guard, and ping-pongs between the two apps forever
 * (Safari: "too many redirects"). Rendering the form instead lets one fresh
 * sign-in replace the stale cookie.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  // `force=1` comes from the mobile guard's loop breaker: the visitor's
  // cookie already survived one pass-through and mobile still rejected it,
  // so this pass MUST render the form — a fresh sign-in replaces the cookie
  // with one both apps accept.
  const forced = sp.force === "1";

  if (!forced && (await getAdminUser())) {
    // Tag the hand-off so the mobile guard can recognise a rejected
    // pass-through on its way back and break the cycle instead of looping.
    const handoff = new URL(next, "https://opencollective.app");
    handoff.searchParams.set("loop", "1");
    redirect(handoff.toString());
  }

  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
