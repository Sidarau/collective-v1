import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOperatorPrincipal } from "@/lib/guard";
import { isGuarded, first, type SearchParams } from "@/lib/page-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in — Open Collective" };

const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ?? "https://opencollective.app";

/**
 * There is no local login form — the only operator sign-in lives on the
 * parent domain. This route exists so old /login links and the error
 * bounces from /api/auth/magic land somewhere sensible: straight through to
 * the admin console, with the absolute destination carried in `next` (and
 * any error, so link_invalid still explains itself there).
 */
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  // `next` is attacker-supplied and ends up in a redirect: "//evil.example"
  // and "/\evil.example" are protocol-relative and would leave the app. Only
  // a single slash followed by a non-slash is a path on this origin.
  const requested = first(sp.next);
  const next = requested && /^\/(?![/\\])/.test(requested) ? requested : "/";

  // Preview deploys have no accounts: the guard is off and /login sends you
  // straight to the fixture gallery.
  if (!isGuarded()) redirect(next);

  // Already signed in → never show a form, go where you were headed.
  if (await getOperatorPrincipal()) redirect(next);

  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "mobile.opencollective.app";
  const proto = headerList.get("x-forwarded-proto") ?? "https";

  const admin = new URL("/login", ADMIN_ORIGIN);
  admin.searchParams.set("next", `${proto}://${host}${next}`);
  const error = first(sp.error);
  if (error) admin.searchParams.set("error", error);
  redirect(admin.toString());
}
