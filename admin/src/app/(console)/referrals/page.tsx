import PageHeader from "@/components/PageHeader";
import ErrorBanner from "@/components/ErrorBanner";
import CopyButton from "@/components/CopyButton";
import { listOpenPhoneInvites, listReferralLinks } from "@/lib/funnel-data";
import {
  createPhoneInviteAction,
  createReferralLinkAction,
  createReturningMemberInviteAction,
  expirePhoneInviteAction,
  toggleReferralLinkAction,
} from "@/lib/funnel-actions";
import { fmtDate } from "@/lib/format";
import { config } from "@core/config";

export const dynamic = "force-dynamic";

const WA_COPY: Record<string, string> = {
  member_returning:
    "Your entrance to the Collective is ready — no forms, no call. Claim it here:",
  member_new: "You've been vouched for at the Collective. Introduce yourself here:",
};

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [links, phoneInvites] = await Promise.all([listReferralLinks(), listOpenPhoneInvites()]);
  const base = config.baseUrl.replace(/\/$/, "");
  const urlFor = (kind: string, code: string) => `${base}/${kind === "member" ? "r" : "v"}/${code}`;
  const welcomeUrl = (token: string) => `${base}/welcome/${token}`;
  const waHref = (invite: { phone: string | null; kind: string; token: string }) =>
    `https://wa.me/${(invite.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(
      `${WA_COPY[invite.kind] || WA_COPY.member_new} ${welcomeUrl(invite.token)}`
    )}`;

  return (
    <>
      <PageHeader title="Referral links" eyebrow="Doors" />
      <ErrorBanner error={error} />

      {/* WhatsApp invites — for people we only have a number for */}
      <section className="panel mb-5 p-5">
        <p className="label">Invite by WhatsApp — no email yet</p>
        <p className="mt-1 text-[12px] text-muted">
          Creates a one-time entrance link to paste into WhatsApp. Past guests skip the
          application and Dominik&apos;s call — they leave an email, pick a password, done.
          Prospects go into the normal introduction.
        </p>
        <form action={createPhoneInviteAction} className="mt-4 grid grid-cols-1 items-end gap-3 md:grid-cols-[1.2fr_1fr_1fr_1.4fr_auto]">
          <div>
            <label className="label">Phone (international)</label>
            <input name="phone" type="tel" required className="input" placeholder="+34600123456" />
          </div>
          <div>
            <label className="label">First name</label>
            <input name="firstName" className="input" />
          </div>
          <div>
            <label className="label">Last name</label>
            <input name="lastName" className="input" />
          </div>
          <div>
            <label className="label">Type</label>
            <select name="kind" className="input" defaultValue="member_returning">
              <option value="member_returning">Past guest — instant member</option>
              <option value="member_new">Prospect — application flow</option>
            </select>
          </div>
          <button type="submit" className="btn btn-gold">
            Create link
          </button>
        </form>

        {phoneInvites.length > 0 && (
          <div className="mt-5 space-y-2">
            {phoneInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line bg-white/[0.03] px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">
                    {[inv.first_name, inv.last_name].filter(Boolean).join(" ") || "Unnamed"}{" "}
                    <span className="text-muted">· {inv.phone}</span>
                  </p>
                  <p className="text-[11px] text-faint">
                    {inv.kind === "member_returning" ? "instant member" : "prospect"} · expires{" "}
                    {fmtDate(inv.expires_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a href={waHref(inv)} target="_blank" rel="noopener noreferrer" className="btn btn-gold">
                    Open in WhatsApp
                  </a>
                  <CopyButton value={welcomeUrl(inv.token)} label="Copy link" />
                  <form action={expirePhoneInviteAction}>
                    <input type="hidden" name="id" value={inv.id} />
                    <button type="submit" className="btn btn-red">
                      Expire
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel p-5">
        <p className="label">Fast-track a past guest</p>
        <p className="mt-1 text-[12px] text-muted">
          Creates a member account, sends password setup, and only asks them to complete
          their member-visible profile. Email, password, phone, and WhatsApp stay private.
        </p>
        <form action={createReturningMemberInviteAction} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="label">First name</label>
              <input name="firstName" required className="input" />
            </div>
            <div>
              <label className="label">Last name</label>
              <input name="lastName" required className="input" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Email</label>
              <input name="email" type="email" required className="input" placeholder="guest@example.com" />
            </div>
          </div>
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_2fr_auto]">
            <div>
              <label className="label">Phone</label>
              <input name="phone" type="tel" className="input" />
            </div>
            <div>
              <label className="label">WhatsApp</label>
              <input name="whatsapp" type="tel" className="input" />
            </div>
            <div>
              <label className="label">Admin note</label>
              <input
                name="note"
                className="input"
                placeholder="Who referred them, prior stay context, anything operators should know"
              />
            </div>
            <button type="submit" className="btn btn-gold">
              Send setup link
            </button>
          </div>
        </form>
      </section>

      <section className="panel mt-5 p-5">
        <p className="label">Open a new door</p>
        <form action={createReferralLinkAction} className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_150px_150px_120px_auto]">
          <div>
            <label className="label">Label</label>
            <input name="label" required className="input" placeholder='e.g. "Don — WhatsApp"' />
          </div>
          <div>
            <label className="label">Kind</label>
            <select name="kind" className="input">
              <option value="member">Member</option>
              <option value="vendor">Vendor / staff</option>
            </select>
          </div>
          <div>
            <label className="label">Code (optional)</label>
            <input name="code" className="input" placeholder="auto" />
          </div>
          <div>
            <label className="label">Max uses</label>
            <input name="maxUses" type="number" min="1" className="input" placeholder="∞" />
          </div>
          <button type="submit" className="btn btn-gold">
            Create link
          </button>
        </form>
        <p className="mt-3 text-[12px] text-faint">
          Member doors open the application at /r/&lt;code&gt;; vendor doors at /v/&lt;code&gt;.
          Share them anywhere — WhatsApp, a card, a story. Close a door any time.
        </p>
      </section>

      <section className="panel mt-5 overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Door</th>
              <th>Kind</th>
              <th>Link</th>
              <th>Uses</th>
              <th>Created</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.id} className={link.active ? "" : "opacity-50"}>
                <td>
                  <p className="font-medium text-ink">{link.label}</p>
                  {link.note && <p className="text-xs text-muted">{link.note}</p>}
                </td>
                <td>
                  <span className={`chip ${link.kind === "member" ? "chip-gold" : ""}`}>{link.kind}</span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <code className="text-[12px] text-muted">/{link.kind === "member" ? "r" : "v"}/{link.code}</code>
                    <CopyButton value={urlFor(link.kind, link.code)} />
                  </div>
                </td>
                <td>
                  {link.use_count}
                  {link.max_uses ? ` / ${link.max_uses}` : ""}
                </td>
                <td>{fmtDate(link.created_at)}</td>
                <td>
                  <span className={`chip ${link.active ? "chip-green" : "chip-red"}`}>
                    {link.active ? "open" : "closed"}
                  </span>
                </td>
                <td>
                  <form action={toggleReferralLinkAction}>
                    <input type="hidden" name="id" value={link.id} />
                    <input type="hidden" name="active" value={link.active ? "false" : "true"} />
                    <button type="submit" className={`btn ${link.active ? "btn-red" : ""}`}>
                      {link.active ? "Close" : "Reopen"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {links.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted">
                  No doors yet — create the first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
