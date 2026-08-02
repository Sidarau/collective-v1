import { NextResponse } from "next/server";
import { getFounderReviewAccess } from "@/lib/founder-review-auth";
import {
  createFounderReviewFileUrl,
  FOUNDER_REVIEW_VERSION,
  getFounderReviewFile,
} from "@/lib/founder-review-storage";
import { writeAudit } from "@core/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> }
) {
  const access = await getFounderReviewAccess();
  if (access.status === "unauthenticated") {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: PRIVATE_HEADERS }
    );
  }
  if (access.status === "forbidden") {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
  }

  const { filename } = await context.params;
  const file = getFounderReviewFile(filename);
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
  }

  try {
    const signedUrl = await createFounderReviewFileUrl(filename, file);
    await writeAudit({
      actorId: access.user.id,
      actorEmail: access.user.email,
      action: "founder_review.download",
      entityType: "user",
      entityId: access.user.id,
      summary: `Opened founder review file: ${filename}`,
      meta: { filename, version: FOUNDER_REVIEW_VERSION },
    });

    const response = NextResponse.redirect(signedUrl, 307);
    Object.entries(PRIVATE_HEADERS).forEach(([name, value]) => response.headers.set(name, value));
    return response;
  } catch (error) {
    console.error(`Founder review file failed (${filename}):`, error);
    return NextResponse.json(
      { error: "File unavailable" },
      { status: 503, headers: PRIVATE_HEADERS }
    );
  }
}
