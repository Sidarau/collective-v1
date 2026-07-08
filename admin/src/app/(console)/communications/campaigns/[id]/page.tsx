import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import ErrorBanner from "@/components/ErrorBanner";
import { getCampaign, resolveCampaignRecipients, type CampaignAudience } from "@/lib/funnel-data";
import { saveCampaignAction, sendCampaignAction } from "@/lib/comms-actions";
import { getEmailMode } from "@core/email";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const ROLES: [string, string][] = [
  ["member", "Members"],
  ["lead", "Leads (funnel)"],
  ["admin", "Admins"],
  ["operator", "Operators"],
];

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  const audience = (campaign.audience || {}) as CampaignAudience;
  const recipients = await resolveCampaignRecipients(audience);
  const mode = getEmailMode();
  const editable = campaign.status === "draft";

  return (
    <>
      <Link href="/communications" className="mb-2 inline-block text-[12px] text-muted hover:text-ink">
        ← Communications
      </Link>
      <PageHeader title={campaign.name} eyebrow="Campaign">
        <StatusChip value={campaign.status} />
      </PageHeader>
      <ErrorBanner error={error} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        <section className="panel p-5">
          <form action={saveCampaignAction} className="space-y-4">
            <input type="hidden" name="id" value={campaign.id} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Name (internal)</label>
                <input name="name" required defaultValue={campaign.name} className="input" disabled={!editable} />
              </div>
              <div>
                <label className="label">Subject</label>
                <input name="subject" defaultValue={campaign.subject} className="input" disabled={!editable} />
              </div>
            </div>
            <div>
              <label className="label">Heading — {"{firstName}"} personalises</label>
              <input
                name="heading"
                defaultValue={campaign.heading}
                className="input"
                placeholder="Dear {firstName},"
                disabled={!editable}
              />
            </div>
            <div>
              <label className="label">Body</label>
              <textarea
                name="body"
                defaultValue={campaign.body_md}
                className="input"
                rows={10}
                disabled={!editable}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Button link (optional)</label>
                <input name="ctaHref" defaultValue={campaign.cta_href || ""} className="input" disabled={!editable} />
              </div>
              <div>
                <label className="label">Button label</label>
                <input name="ctaLabel" defaultValue={campaign.cta_label || ""} className="input" disabled={!editable} />
              </div>
            </div>
            <div>
              <label className="label">Audience</label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map(([value, label]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line bg-base px-2.5 py-1.5 text-[12px] text-muted has-[:checked]:border-gold/60 has-[:checked]:text-gold"
                  >
                    <input
                      type="checkbox"
                      name="roles"
                      value={value}
                      defaultChecked={(audience.roles || ["member"]).includes(value)}
                      className="accent-[#e0bd73]"
                      disabled={!editable}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            {editable && (
              <button type="submit" className="btn btn-gold">
                Save draft
              </button>
            )}
          </form>
        </section>

        <aside className="space-y-4 self-start">
          <section className="panel p-4">
            <p className="label">Audience preview</p>
            <p className="text-2xl font-semibold text-ink">{recipients.length}</p>
            <p className="text-[12px] text-muted">
              distinct recipients · suppressed addresses are skipped at send time
            </p>
          </section>

          {campaign.status === "sent" ? (
            <section className="panel p-4">
              <p className="label">Result</p>
              <p className="text-sm text-ink">
                {campaign.sent_count}/{campaign.total_recipients} written to outbox
              </p>
              <p className="text-[12px] text-faint">sent {fmtDate(campaign.sent_at)}</p>
            </section>
          ) : (
            <section className={`panel border p-4 ${mode === "send" ? "border-red/40" : "border-gold/40"}`}>
              <p className="label">Send</p>
              <p className="text-[12px] text-muted">
                {mode === "send"
                  ? "Email mode is SEND — this delivers real email to the audience via Resend."
                  : "Email mode is LOG — sending writes outbox rows only; nothing is delivered. Safe to test."}
              </p>
              <form action={sendCampaignAction} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={campaign.id} />
                <label className="flex items-center gap-2 text-[12px] text-muted">
                  <input type="checkbox" name="confirm" className="accent-[#e0bd73]" /> I reviewed
                  the draft and the audience
                </label>
                <button type="submit" className={`btn w-full ${mode === "send" ? "btn-red" : "btn-gold"}`}>
                  Send to {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
                </button>
              </form>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
