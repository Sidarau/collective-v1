import PageHeader from "@/components/PageHeader";
import ErrorBanner from "@/components/ErrorBanner";
import CopyButton from "@/components/CopyButton";
import { listReferralLinks } from "@/lib/funnel-data";
import { createReferralLinkAction, toggleReferralLinkAction } from "@/lib/funnel-actions";
import { fmtDate } from "@/lib/format";
import { config } from "@core/config";

export const dynamic = "force-dynamic";

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const links = await listReferralLinks();
  const base = config.baseUrl.replace(/\/$/, "");
  const urlFor = (kind: string, code: string) => `${base}/${kind === "member" ? "r" : "v"}/${code}`;

  return (
    <>
      <PageHeader title="Referral links" eyebrow="Doors" />
      <ErrorBanner error={error} />

      <section className="panel p-5">
        <p className="label">Open a new door</p>
        <form action={createReferralLinkAction} className="grid grid-cols-[1fr_150px_150px_120px_auto] items-end gap-3">
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
