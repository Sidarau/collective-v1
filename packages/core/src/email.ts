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
 * The house email shell — the landing page's language in an inbox: the deep
 * green ground, a champagne hairline card, the lockup, serif voice.
 *
 * Three things here are not decoration.
 *
 * 1. **`<meta charset="utf-8">` and a real document wrapper.** Without them a
 *    mail client is free to decode the body as Latin-1, and every em-dash in
 *    our copy arrives as `â€"`. That is what "the email wasn't formatted
 *    correctly" turned out to mean, and it affected every template.
 * 2. **`color-scheme` / `supported-color-schemes`.** Apple Mail and Gmail
 *    invert dark emails on a dark phone otherwise, which turns a considered
 *    dark design into a muddy light one.
 * 3. **Tables, not flex.** Outlook renders on Word's engine; a nested table
 *    with inline styles is the only layout that survives it.
 *
 * The preheader is the grey line the inbox shows next to the subject. Left
 * empty it fills with whatever text comes first — usually the logo's alt.
 */
const shell = (inner: string, preheader: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${config.brandName}</title>
  </head>
  <body style="margin:0;padding:0;background:#07100e;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">
      ${preheader}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#07100e;margin:0;padding:0;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <!-- width="100%" + max-width, never width="480": the HTML attribute
               beats the stylesheet in several engines, and a fixed 480 table
               overflows a phone, which is where these get opened. -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="max-width:480px;">
            <tr>
              <td align="center" style="padding:0 0 30px;">
                <img src="${LOGO_URL}" alt="${config.brandName}" width="184"
                     style="width:184px;max-width:62%;height:auto;border:0;display:block;" />
              </td>
            </tr>
            <tr>
              <td style="background:#0b1714;border:1px solid rgba(228,190,109,0.22);border-radius:22px;
                         padding:34px 30px;color:#f7fbf8;
                         font-family:Georgia,'Times New Roman',serif;">
                ${inner}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:26px 0 0;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:rgba(247,251,248,0.42);
                          font-family:-apple-system,'Segoe UI',system-ui,sans-serif;letter-spacing:0.03em;">
                  ${config.brandName} ·
                  <a href="mailto:${config.supportEmail}"
                     style="color:rgba(247,251,248,0.6);text-decoration:none;">${config.supportEmail}</a>
                </p>
                <p style="margin:9px 0 0;font-size:11px;color:rgba(247,251,248,0.28);
                          font-family:-apple-system,'Segoe UI',system-ui,sans-serif;
                          letter-spacing:0.16em;text-transform:uppercase;">
                  Ibiza · By referral only
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

/**
 * A button that survives Outlook, which ignores padding on an anchor. The
 * table cell carries the shape; the anchor only carries the text.
 */
const button = (href: string, label: string) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0;">
    <tr>
      <td align="center" bgcolor="#e4be6d" style="border-radius:999px;">
        <a href="${href}"
           style="display:inline-block;padding:14px 30px;color:#07100e;text-decoration:none;
                  font-family:-apple-system,'Segoe UI',system-ui,sans-serif;font-size:15px;
                  font-weight:600;letter-spacing:0.01em;border-radius:999px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;

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

  const html = shell(
    `
    <h1 style="font-size:24px;line-height:1.25;font-weight:400;margin:0 0 16px;color:#f7fbf8;
               font-family:Georgia,'Times New Roman',serif;">${params.heading}</h1>
    <p style="font-size:15px;line-height:1.7;color:rgba(247,251,248,0.75);margin:0 0 28px;
              font-family:-apple-system,'Segoe UI',system-ui,sans-serif;">
      ${params.body}
    </p>
    ${params.ctaHref ? button(params.ctaHref, params.ctaLabel || "Open") : ""}
    ${
      params.footnote
        ? `<p style="font-size:13px;line-height:1.6;color:rgba(247,251,248,0.45);margin:28px 0 0;
                     font-family:-apple-system,'Segoe UI',system-ui,sans-serif;">${params.footnote}</p>`
        : ""
    }
  `,
    // The inbox preview line: the first sentence of the message, not the logo's
    // alt text and not the footer.
    params.body.replace(/<[^>]*>/g, "").slice(0, 140),
  );
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
