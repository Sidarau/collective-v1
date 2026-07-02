import { Resend } from "resend";
import { config } from "./config";

interface SendMagicLinkParams {
  to: string;
  firstName: string;
  magicLink: string;
}

export async function sendMagicLinkEmail({ to, firstName, magicLink }: SendMagicLinkParams): Promise<void> {
  const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;
  if (!resend) {
    console.warn("RESEND_API_KEY not configured; skipping email send.");
    console.log(`[DEV] Magic link for ${to}: ${magicLink}`);
    return;
  }

  const from = config.resendFromEmail || "onboarding@resend.dev";
  const brandName = config.brandName;
  const villaName = config.villaName;

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1c1917;">
      <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Hi ${firstName},</h1>
      <p style="font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
        Here is your one-time login link for ${brandName}${villaName ? ` — ${villaName}` : ""}.
        It expires in 24 hours and can only be used once.
      </p>
      <a
        href="${magicLink}"
        style="display: inline-block; background: #1c1917; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;"
      >
        Log in to ${brandName}
      </a>
      <p style="font-size: 14px; color: #78716c; margin-top: 24px;">
        If you didn't request this, you can safely ignore this email.
      </p>
      <p style="font-size: 12px; color: #a8a29e; margin-top: 32px;">
        ${brandName} · ${config.supportEmail}
      </p>
    </div>
  `;

  const text = `Hi ${firstName},\n\nHere is your one-time login link for ${brandName}${villaName ? ` — ${villaName}` : ""}:\n\n${magicLink}\n\nIt expires in 24 hours and can only be used once.\n\nIf you didn't request this, you can safely ignore this email.`;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: `Your ${brandName} login link`,
      html,
      text,
    });

    if (error) {
      console.error("Resend error details:", JSON.stringify(error));
      throw new Error(`Resend email failed: ${error.message}`);
    }

    console.log("Resend email sent:", data?.id);
  } catch (error) {
    console.error("sendMagicLinkEmail error:", error);
    throw error;
  }
}
