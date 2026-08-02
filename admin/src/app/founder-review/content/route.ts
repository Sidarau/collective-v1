import { getFounderReviewAccess } from "@/lib/founder-review-auth";
import { getFounderReviewHtml, FOUNDER_REVIEW_VERSION } from "@/lib/founder-review-storage";
import { writeAudit } from "@core/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "Content-Security-Policy": [
    "default-src 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'none'",
    "img-src 'self' data: https://*.supabase.co",
    "font-src https://fonts.gstatic.com",
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'unsafe-inline'",
  ].join("; "),
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET() {
  const access = await getFounderReviewAccess();
  if (access.status === "unauthenticated") {
    return new Response("Authentication required", {
      status: 401,
      headers: SECURITY_HEADERS,
    });
  }
  if (access.status === "forbidden") {
    return new Response("Not found", { status: 404, headers: SECURITY_HEADERS });
  }

  try {
    const html = await getFounderReviewHtml();
    await writeAudit({
      actorId: access.user.id,
      actorEmail: access.user.email,
      action: "founder_review.view",
      entityType: "user",
      entityId: access.user.id,
      summary: `Viewed founder review ${FOUNDER_REVIEW_VERSION}`,
      meta: { version: FOUNDER_REVIEW_VERSION },
    });

    return new Response(html, {
      headers: {
        ...SECURITY_HEADERS,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Founder review render failed:", error);
    return new Response("Founder review unavailable", {
      status: 503,
      headers: SECURITY_HEADERS,
    });
  }
}
