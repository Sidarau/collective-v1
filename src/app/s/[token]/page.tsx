import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import {
  getShareByToken,
  shareState,
  verifySharePassword,
  verifyShareSession,
  mintShareSession,
  getLegalDocument,
  recordLegalAcceptance,
  hasAcceptedLegal,
} from "@core/kb-shares";

export const dynamic = "force-dynamic";

const ENABLED = () => process.env.EXTERNAL_SHARES_ENABLED === "true";
const SHARE_COOKIE = "kbshare";

/**
 * Confidential share gate (ADR §5.3). Opening this URL returns NO document —
 * only a password (and, if required, NDA) gate. On success we mint a short
 * share-session cookie scoped to this share's path; the document bytes are
 * served by ./view, which re-checks the session and live share state.
 */
export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  if (!ENABLED()) notFound();
  const { token } = await params;
  const { e } = await searchParams;

  const share = await getShareByToken(token);
  // Generic response whether the share is missing, revoked, expired, or spent —
  // never leak which (ADR T2).
  const unavailable = !share || shareState(share) !== "ok";

  let unlocked = false;
  if (share && !unavailable) {
    const jar = await cookies();
    const sess = jar.get(SHARE_COOKIE)?.value;
    if (sess) {
      const claims = await verifyShareSession(sess);
      unlocked = !!claims && claims.sid === share.id;
    }
  }

  const legal = share?.require_nda && share.legal_document_id
    ? await getLegalDocument(share.legal_document_id)
    : null;

  return (
    <main style={wrap}>
      <div style={card}>
        <div style={{ letterSpacing: ".16em", fontSize: 11, textTransform: "uppercase", color: "#a99", marginBottom: 14 }}>
          Collective · Confidential
        </div>
        {unavailable ? (
          <>
            <h1 style={h1}>This link is not available</h1>
            <p style={muted}>
              It may have expired or been withdrawn. Contact your host if you believe this is a
              mistake.
            </p>
          </>
        ) : unlocked ? (
          <>
            <h1 style={h1}>You&rsquo;re verified</h1>
            <p style={muted}>This document is confidential and tied to your invitation.</p>
            <a href={`/s/${token}/view`} style={btn}>
              Open document
            </a>
          </>
        ) : (
          <>
            <h1 style={h1}>Enter to view</h1>
            <p style={muted}>
              This document was shared with <strong>{share!.recipient_label}</strong>. Enter the
              password from your invitation{legal ? " and accept the terms" : ""} to continue.
            </p>
            {e && <p style={errBox}>{decodeURIComponent(e)}</p>}
            <form action={unlockShareAction} style={{ marginTop: 18 }}>
              <input type="hidden" name="token" value={token} />
              <label style={label}>Password</label>
              <input name="password" type="password" required autoFocus style={input} />
              {legal && (
                <div style={{ marginTop: 18 }}>
                  <label style={label}>{legal.title}</label>
                  <div style={legalBox}>{legal.body_md}</div>
                  <label style={{ ...label, marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="checkbox" name="accept" required /> I accept these terms
                  </label>
                  <label style={{ ...label, marginTop: 10 }}>Type your full name</label>
                  <input name="typedName" style={input} placeholder="Full name" />
                </div>
              )}
              <button type="submit" style={{ ...btn, width: "100%", marginTop: 18, border: "none", cursor: "pointer" }}>
                Verify &amp; continue
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

async function unlockShareAction(formData: FormData) {
  "use server";
  if (!ENABLED()) notFound();
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const back = (msg: string) => redirect(`/s/${token}?e=${encodeURIComponent(msg)}`);

  const share = await getShareByToken(token);
  if (!share || shareState(share) !== "ok") back("This link is not available.");
  const s = share!;

  const check = await verifySharePassword(s, password);
  if (check.locked) back("Too many attempts. Try again later.");
  if (!check.ok) back("That password is not correct.");

  if (s.require_nda && s.legal_document_id) {
    const legal = await getLegalDocument(s.legal_document_id);
    if (!legal) back("Terms unavailable — contact your host.");
    const accepted = formData.get("accept") === "on";
    const typedName = String(formData.get("typedName") || "").trim();
    if (!accepted || typedName.length < 2) back("Please accept the terms and type your name.");
    if (!(await hasAcceptedLegal(s.id, legal!))) {
      const hdrs = await headers();
      await recordLegalAcceptance({
        shareId: s.id,
        legal: legal!,
        typedName,
        ip: hdrs.get("x-forwarded-for"),
        ua: hdrs.get("user-agent"),
      });
    }
  }

  const jwt = await mintShareSession(s.id, s.revision_id);
  const jar = await cookies();
  jar.set(SHARE_COOKIE, jwt, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: `/s/${token}`,
    maxAge: 60 * 60,
  });
  redirect(`/s/${token}/view`);
}

const wrap: React.CSSProperties = { minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0e0d0b", padding: 24 };
const card: React.CSSProperties = { width: "100%", maxWidth: 440, background: "#161512", border: "1px solid #2a2721", borderRadius: 18, padding: "34px 30px", color: "#efe9df", boxShadow: "0 30px 80px rgba(0,0,0,.5)" };
const h1: React.CSSProperties = { fontSize: 26, margin: "0 0 10px", fontWeight: 600, letterSpacing: "-0.01em" };
const muted: React.CSSProperties = { color: "#a29a8c", fontSize: 14, lineHeight: 1.6, margin: 0 };
const label: React.CSSProperties = { display: "block", fontSize: 12, color: "#a29a8c", marginBottom: 6 };
const input: React.CSSProperties = { width: "100%", background: "#0e0d0b", border: "1px solid #2f2c25", borderRadius: 10, padding: "11px 13px", color: "#efe9df", fontSize: 15 };
const btn: React.CSSProperties = { display: "inline-block", marginTop: 16, background: "#c8a25c", color: "#161512", padding: "12px 18px", borderRadius: 10, fontWeight: 600, textDecoration: "none", textAlign: "center" };
const errBox: React.CSSProperties = { marginTop: 14, background: "#2a1a17", border: "1px solid #5a2f28", color: "#e6a99b", padding: "9px 12px", borderRadius: 8, fontSize: 13 };
const legalBox: React.CSSProperties = { maxHeight: 160, overflow: "auto", background: "#0e0d0b", border: "1px solid #2f2c25", borderRadius: 10, padding: 12, fontSize: 12.5, color: "#c8bfae", whiteSpace: "pre-wrap", lineHeight: 1.5 };
