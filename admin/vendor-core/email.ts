import { Resend } from "resend";
import { config } from "./config";
import { getSupabaseAdmin } from "./supabase";
import { titleCaseName } from "./names";
import type { CrmEntityType, EmailMessageStatus, Json } from "./database.types";

/**
 * Outbox-first email. Every send attempt becomes an `email_messages` row:
 * suppression-checked, then delivered via Resend only when EMAIL_MODE=send.
 * Default mode is `log` — nothing leaves the building until Alex flips the
 * env var, but flows stay fully testable (links are stored in row meta and
 * surfaced in the operator console).
 */
export type EmailMode = "send" | "log";

export function getEmailMode(): EmailMode {
  return process.env.EMAIL_MODE === "send" ? "send" : "log";
}

function getResend(): Resend | null {
  return config.resendApiKey ? new Resend(config.resendApiKey) : null;
}

const LOGO_URL = `${config.baseUrl.replace(/\/$/, "")}/brand/logo-horizontal.png`;

/**
 * The house email shell — the members' app design language in an inbox:
 * near-black ground, a champagne hairline card, the Open Collective lockup,
 * serif voice. Table-based + inline styles for client compatibility.
 */
const shell = (inner: string) => `
  <div style="background:#07100e;margin:0;padding:40px 16px;font-family:Georgia,'Times New Roman',serif;">
    <div style="max-width:480px;margin:0 auto;">
      <div style="text-align:center;margin:0 0 30px;">
        <img src="${LOGO_URL}" alt="${config.brandName}" width="184" style="width:184px;max-width:62%;height:auto;border:0;display:inline-block;" />
      </div>
      <div style="background:rgba(255,255,255,0.055);border:1px solid rgba(228,190,109,0.22);border-radius:22px;padding:34px 30px;color:#f7fbf8;">
        ${inner}
      </div>
      <p style="text-align:center;font-size:12px;color:rgba(247,251,248,0.42);margin:26px 0 0;font-family:-apple-system,system-ui,sans-serif;letter-spacing:0.03em;">
        ${config.brandName} · <a href="mailto:${config.supportEmail}" style="color:rgba(247,251,248,0.6);text-decoration:none;">${config.supportEmail}</a>
      </p>
      <p style="text-align:center;font-size:11px;color:rgba(247,251,248,0.28);margin:9px 0 0;font-family:-apple-system,system-ui,sans-serif;letter-spacing:0.16em;text-transform:uppercase;">
        Ibiza · By referral only
      </p>
    </div>
  </div>`;

const button = (href: string, label: string) => `
  <a href="${href}" style="display:inline-block;background:#e4be6d;color:#07100e;text-decoration:none;padding:14px 30px;border-radius:999px;font-weight:600;font-family:-apple-system,system-ui,sans-serif;font-size:15px;letter-spacing:0.01em;">
    ${label}
  </a>`;

export interface TrackedEmailParams {
  to: string;
  subject: string;
  heading: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
  footnote?: string;
  template?: string;
  entityType?: CrmEntityType;
  entityId?: string | null;
  actorId?: string | null;
  /** Extra values worth keeping with the log row (e.g. minted link). */
  meta?: Record<string, Json | undefined>;
}

export interface TrackedEmailResult {
  id: string | null;
  status: EmailMessageStatus;
  suppressed: boolean;
  mode: EmailMode;
}

export async function sendTrackedEmail(params: TrackedEmailParams): Promise<TrackedEmailResult> {
  const supabase = getSupabaseAdmin();
  const to = params.to.toLowerCase().trim();
  const mode = getEmailMode();

  // 1. Suppression gate — even at <3k emails/season this is non-negotiable.
  const { data: suppression } = await supabase
    .from("email_suppressions")
    .select("id, reason")
    .eq("email", to)
    .maybeSingle();

  const baseRow = {
    to_email: to,
    template: params.template || null,
    subject: params.subject,
    entity_type: params.entityType || null,
    entity_id: params.entityId || null,
    created_by: params.actorId || null,
    meta: (params.meta as Json) || {},
  };

  if (suppression) {
    const { data } = await supabase
      .from("email_messages")
      .insert({ ...baseRow, status: "suppressed", error: `suppressed:${suppression.reason}` })
      .select("id")
      .single();
    return { id: data?.id || null, status: "suppressed", suppressed: true, mode };
  }

  // 2. Log the attempt.
  const { data: row, error: insertError } = await supabase
    .from("email_messages")
    .insert({ ...baseRow, status: "logged" })
    .select("id")
    .single();
  if (insertError) console.error("[email] outbox insert failed:", insertError.message);
  const messageId = row?.id || null;

  // 3. Deliver only when explicitly enabled.
  if (mode !== "send") {
    console.log(`[email:log-mode] ${params.template || "email"} -> ${to} (not sent)`);
    return { id: messageId, status: "logged", suppressed: false, mode };
  }

  const resend = getResend();
  if (!resend) {
    if (messageId) {
      await supabase
        .from("email_messages")
        .update({ status: "failed", error: "RESEND_API_KEY missing" })
        .eq("id", messageId);
    }
    return { id: messageId, status: "failed", suppressed: false, mode };
  }

  const html = shell(`
    <h1 style="font-size:22px;font-weight:400;margin:0 0 16px;">${params.heading}</h1>
    <p style="font-size:15px;line-height:1.7;color:rgba(247,251,248,0.75);font-family:system-ui,sans-serif;margin:0 0 28px;">
      ${params.body}
    </p>
    ${params.ctaHref ? button(params.ctaHref, params.ctaLabel || "Open") : ""}
    ${params.footnote ? `<p style="font-size:13px;color:rgba(247,251,248,0.45);margin-top:28px;font-family:system-ui,sans-serif;">${params.footnote}</p>` : ""}
  `);
  const text = `${params.heading}\n\n${params.body}${params.ctaHref ? `\n\n${params.ctaHref}` : ""}`;

  try {
    const { data, error } = await resend.emails.send({
      from: config.resendFromEmail,
      to,
      subject: params.subject,
      html,
      text,
    });
    if (error) throw new Error(error.message);
    if (messageId) {
      await supabase
        .from("email_messages")
        .update({ status: "sent", resend_id: data?.id || null })
        .eq("id", messageId);
    }
    return { id: messageId, status: "sent", suppressed: false, mode };
  } catch (err) {
    const message = err instanceof Error ? err.message : "send failed";
    console.error("[email] send failed:", message);
    if (messageId) {
      await supabase
        .from("email_messages")
        .update({ status: "failed", error: message.slice(0, 500) })
        .eq("id", messageId);
    }
    return { id: messageId, status: "failed", suppressed: false, mode };
  }
}

// ---------- Convenience wrappers (existing call sites keep working) ----------

interface SendMagicLinkParams {
  to: string;
  firstName: string;
  magicLink: string;
  intro?: string;
  cta?: string;
  template?: string;
  entityType?: CrmEntityType;
  entityId?: string | null;
  actorId?: string | null;
}

export async function sendMagicLinkEmail(params: SendMagicLinkParams): Promise<TrackedEmailResult> {
  const intro =
    params.intro ||
    `Your private entrance to ${config.brandName} is ready. This link is yours alone — it expires in 7 days and works once.`;
  return sendTrackedEmail({
    to: params.to,
    subject: `Your ${config.brandName} entrance`,
    heading: `Dear ${titleCaseName(params.firstName) || "there"},`,
    body: intro,
    ctaHref: params.magicLink,
    ctaLabel: params.cta || "Enter the Circle",
    footnote: "If you didn't expect this, you can safely ignore it.",
    template: params.template || "magic_link",
    entityType: params.entityType,
    entityId: params.entityId,
    actorId: params.actorId,
    meta: { magic_link: params.magicLink },
  });
}

export async function sendNotificationEmail(params: {
  to: string;
  subject: string;
  heading: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
  template?: string;
  entityType?: CrmEntityType;
  entityId?: string | null;
  actorId?: string | null;
}): Promise<TrackedEmailResult> {
  return sendTrackedEmail({ template: "notification", ...params });
}
