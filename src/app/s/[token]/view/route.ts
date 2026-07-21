import { NextRequest, NextResponse } from "next/server";
import {
  getShareByToken,
  shareState,
  verifyShareSession,
  incrementShareView,
} from "@core/kb-shares";
import { getRevision } from "@core/kb-revisions";
import { getKbNode } from "@core/kb";
import { renderPage, type KbTemplate, type KbTheme } from "@core/kb-render";
import { recordAccessEvent } from "@core/kb-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHARE_COOKIE = "kbshare";
const ENABLED = () => process.env.EXTERNAL_SHARES_ENABLED === "true";

/**
 * Protected document bytes (ADR §5.3, T1/T8/T9). Returned ONLY after the
 * share-session cookie is verified and the share is still live. Never cached.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  if (!ENABLED()) return new NextResponse("Not found", { status: 404 });
  const { token } = await ctx.params;
  const gate = new URL(`/s/${token}`, req.url);

  const share = await getShareByToken(token);
  if (!share) return NextResponse.redirect(gate);

  const state = shareState(share);
  if (state !== "ok") return NextResponse.redirect(gate);

  const sessToken = req.cookies.get(SHARE_COOKIE)?.value;
  const claims = sessToken ? await verifyShareSession(sessToken) : null;
  if (!claims || claims.sid !== share.id) {
    await recordAccessEvent({
      principal: { kind: "external_share", userId: null, entityId: share.id, tokenId: null },
      capability: "kb.view",
      resourceType: "kb_node",
      resourceId: share.node_id,
      decision: "deny",
      reason: "no_session",
    });
    return NextResponse.redirect(gate);
  }

  const revision = await getRevision(share.revision_id);
  if (!revision) return NextResponse.redirect(gate);
  const node = await getKbNode(share.node_id);

  await incrementShareView(share.id);
  await recordAccessEvent({
    principal: { kind: "external_share", userId: null, entityId: share.id, tokenId: null },
    capability: "kb.view",
    resourceType: "kb_node",
    resourceId: share.node_id,
    decision: "allow",
    reason: "ok",
  });

  const html = renderPage({
    title: node?.title || "Document",
    html: revision.html,
    template: (revision.template as KbTemplate) || "article",
    theme: (revision.theme as KbTheme) || {},
    eyebrow: "Collective · Confidential",
    watermark: share.watermark ? share.recipient_label : null,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      // script-free document: no default-src, inline styles only, images self/data/https
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data: https:; base-uri 'none'; form-action 'none'",
    },
  });
}
