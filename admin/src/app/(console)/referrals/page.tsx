import PageHeader from "@/components/PageHeader";
import ErrorBanner from "@/components/ErrorBanner";
import CopyButton from "@/components/CopyButton";
import LabelsInput from "@/components/LabelsInput";
import { listLabelsInUse, listReferralLinks } from "@/lib/funnel-data";
import { createReferralLinkAction, toggleReferralLinkAction } from "@/lib/funnel-actions";
import { doorPath, fmtDate } from "@/lib/format";
import { LABEL_SUGGESTIONS, mergeLabels } from "@core/labels";
import { config } from "@core/config";

export const dynamic = "force-dynamic";

const KIND_COPY: Record<string, { label: string; chip: string; blurb: string }> = {
  member: {
    label: "Member — application + host call",
    chip: "chip-gold",
    blurb: "Introduction form, then fifteen minutes with Dominik.",
  },
  instant_member: {
    label: "Instant member — no screening",
    chip: "chip-green",
    blurb: "Account opens on the spot. For investor decks, QR cards, people you already trust.",
  },
  vendor: { label: "Vendor — hiring funnel", chip: "", blurb: "Vendor application and interview." },
  staff: { label: "Staff — hiring funnel", chip: "", blurb: "Staff application and interview." },
};

/**
 * One door system: every entrance is a link. Kind picks the flow
 * (application + screening, instant account, or hiring), labels stamp the
 * CRM, max uses + expiry bound the exposure. QR the URL anywhere.
 */
export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [links, labelsInUse] = await Promise.all([listReferralLinks(), listLabelsInUse()]);
  const base = config.baseUrl.replace(/\/$/, "");
  const suggestions = mergeLabels(labelsInUse, LABEL_SUGGESTIONS);

  return (
    <>
      <PageHeader title="Doors" eyebrow="Referral links" />
      <ErrorBanner error={error} />

      <section className="panel p-5">
        <p className="label">Open a new door</p>
        <p className="mt-1 text-[12px] text-muted">
          One link covers every situation: members go through the introduction and
          Dominik&apos;s call, instant members get an account with no hoops, vendors and
          staff land in hiring. Labels stick to everyone who enters — you&apos;ll see them
          across the CRM.
        </p>
        <form action={createReferralLinkAction} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1.3fr_1.2fr_140px_110px]">
            <div>
              <label className="label">Name</label>
              <input name="label" required className="input" placeholder='e.g. "Investor deck" or "Don — WhatsApp"' />
            </div>
            <div>
              <label className="label">Kind</label>
              <select name="kind" className="input" defaultValue="member">
                {Object.entries(KIND_COPY).map(([value, k]) => (
                  <option key={value} value={value}>
                    {k.label}
                  </option>
                ))}
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
          </div>
          <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="label">Labels for everyone who enters</label>
              <LabelsInput name="labels" suggestions={suggestions} />
            </div>
            <div>
              <label className="label">Note (internal)</label>
              <input name="note" className="input" placeholder="Where this link travels" />
            </div>
            <button type="submit" className="btn btn-gold self-end">
              Open door
            </button>
          </div>
        </form>
        <p className="mt-3 text-[12px] text-faint">
          Member and instant doors live at /r/&lt;code&gt;; vendor and staff doors at
          /v/&lt;code&gt;. Share anywhere — WhatsApp, a deck, a QR on a card. Close a door
          any time; agents can mint these over MCP too.
        </p>
      </section>

      <section className="panel mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Door</th>
                <th>Kind</th>
                <th>Labels</th>
                <th>Link</th>
                <th>Uses</th>
                <th>Created</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => {
                const kind = KIND_COPY[link.kind] || KIND_COPY.member;
                const path = doorPath(link.kind, link.code);
                return (
                  <tr key={link.id} className={link.active ? "" : "opacity-50"}>
                    <td>
                      <p className="font-medium text-ink">{link.label}</p>
                      {link.note && <p className="text-xs text-muted">{link.note}</p>}
                    </td>
                    <td>
                      <span className={`chip ${kind.chip}`}>{link.kind.replace("_", " ")}</span>
                    </td>
                    <td>
                      {(link.labels || []).length ? (
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {link.labels.map((label) => (
                            <span key={label} className="chip">
                              {label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-faint">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <code className="text-[12px] text-muted">{path}</code>
                        <CopyButton value={`${base}${path}`} />
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
                );
              })}
              {links.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-muted">
                    No doors yet — open the first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
