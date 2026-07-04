import PageHeader from "@/components/PageHeader";
import ErrorBanner from "@/components/ErrorBanner";
import { listContentBlocks } from "@/lib/funnel-data";
import { saveContentBlockAction } from "@/lib/content-actions";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Where each block appears in the member app — shown as a hint. */
const KNOWN_KEYS: Record<string, string> = {
  "landing.hero": "Member app landing — line under the wordmark",
  "join.intro": "Referral application page — intro paragraph",
  "screening.intro": "Call scheduler — intro paragraph",
};

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const blocks = await listContentBlocks();

  return (
    <>
      <PageHeader title="Content" eyebrow="Member-app copy" />
      <ErrorBanner error={error} />

      <div className="grid gap-4">
        {blocks.map((block) => (
          <section key={block.id} className="panel p-5">
            <form action={saveContentBlockAction} className="space-y-3">
              <input type="hidden" name="id" value={block.id} />
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    <code className="text-gold">{block.key}</code>
                  </p>
                  <p className="text-[11px] text-faint">
                    {KNOWN_KEYS[block.key] || "Custom block"} · updated {fmtDate(block.updated_at)}
                  </p>
                </div>
                <button type="submit" className="btn btn-gold">
                  Save
                </button>
              </div>
              <div>
                <label className="label">Title (internal)</label>
                <input name="title" defaultValue={block.title} className="input" />
              </div>
              <div>
                <label className="label">Text</label>
                <textarea name="body" defaultValue={block.body_md} className="input" rows={3} />
              </div>
            </form>
          </section>
        ))}
      </div>

      <section className="panel mt-5 p-5">
        <p className="label">New block</p>
        <form action={saveContentBlockAction} className="flex items-end gap-3">
          <div className="w-64">
            <label className="label">Key</label>
            <input name="key" required className="input" placeholder="portal.welcome" />
          </div>
          <div className="flex-1">
            <label className="label">Title</label>
            <input name="title" className="input" />
          </div>
          <div className="flex-1">
            <label className="label">Text</label>
            <input name="body" className="input" />
          </div>
          <button type="submit" className="btn">
            Create
          </button>
        </form>
        <p className="mt-3 text-[12px] text-faint">
          Blocks are referenced by key from the member app. The three seeded keys are live;
          new keys wire up as the app grows.
        </p>
      </section>
    </>
  );
}
