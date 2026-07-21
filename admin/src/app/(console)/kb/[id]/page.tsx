import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ErrorBanner from "@/components/ErrorBanner";
import { buildKbTree, getKbNode, kbPath, listKbNodes } from "@core/kb";
import { getPublishedRevision, listRevisions } from "@core/kb-revisions";
import { listSharesForNode } from "@core/kb-shares";
import { getSupabaseAdmin } from "@core/supabase";
import type { KbAudience, KbGrantRow } from "@core/database.types";
import { fmtDate } from "@/lib/format";
import { archiveKbNodeAction, createKbNodeAction, saveKbNodeAction } from "@/lib/kb-actions";
import { publishNodeAction, setGrantAction, revokeShareAction } from "@/lib/kb-publish-actions";
import KbShell from "../KbShell";
import ShareCreator from "./ShareCreator";

export const dynamic = "force-dynamic";

const AUDIENCES: [KbAudience, string][] = [
  ["operator", "Operators"],
  ["staff", "Staff"],
  ["member", "Members"],
  ["vendor", "Vendors"],
];

export default async function KbNodePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [nodes, node] = await Promise.all([listKbNodes(), getKbNode(id)]);
  if (!node) notFound();

  const tree = buildKbTree(nodes.filter((n) => n.id !== "never"));
  const crumbs = kbPath(nodes, id);
  const folders = nodes.filter((n) => n.kind === "folder" && n.id !== id);

  // Publishing state (docs only)
  const isDoc = node.kind === "doc";
  const [published, revisions, shares, grantsRes] = isDoc
    ? await Promise.all([
        getPublishedRevision(id),
        listRevisions(id, 8),
        listSharesForNode(id),
        getSupabaseAdmin().from("kb_grants").select("audience, effect").eq("node_id", id),
      ])
    : [null, [], [], { data: [] as Pick<KbGrantRow, "audience" | "effect">[] }];
  const grantedAudiences = new Set(
    ((grantsRes.data as Pick<KbGrantRow, "audience" | "effect">[] | null) || [])
      .filter((g) => g.effect === "allow")
      .map((g) => g.audience)
  );

  return (
    <>
      <PageHeader title="Knowledge base" eyebrow="Collective OS">
        <Link href="/kb" className="btn">
          + New page
        </Link>
      </PageHeader>
      <ErrorBanner error={error} />
      <KbShell tree={tree} activeId={id}>
        <section className="panel p-5">
          <p className="mb-3 text-[12px] text-faint">
            {crumbs.map((c, i) => (
              <span key={c.id}>
                {i > 0 && " / "}
                {c.id === id ? c.title : (
                  <Link href={`/kb/${c.id}`} className="hover:text-ink">
                    {c.title}
                  </Link>
                )}
              </span>
            ))}
            {" · "}updated {fmtDate(node.updated_at)}
          </p>

          <form action={saveKbNodeAction} className="space-y-4">
            <input type="hidden" name="id" value={node.id} />
            <div className="grid grid-cols-[1fr_170px_200px_110px] gap-3">
              <div>
                <label className="label">Title</label>
                <input name="title" required defaultValue={node.title} className="input" />
              </div>
              <div>
                <label className="label">Visible to</label>
                <select name="visibility" defaultValue={node.visibility} className="input">
                  <option value="internal">Operators only</option>
                  <option value="staff">Staff</option>
                  <option value="members">Members</option>
                </select>
              </div>
              <div>
                <label className="label">Inside</label>
                <select name="parentId" defaultValue={node.parent_id || ""} className="input">
                  <option value="">Top level</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Position</label>
                <input name="position" type="number" defaultValue={node.position} className="input" />
              </div>
            </div>

            {node.kind === "doc" ? (
              <div>
                <label className="label">Content (markdown)</label>
                <textarea
                  name="body"
                  defaultValue={node.body_md}
                  className="input font-mono text-[13px] leading-relaxed"
                  rows={22}
                />
              </div>
            ) : (
              <input type="hidden" name="body" value={node.body_md} />
            )}

            <div className="flex items-center justify-between">
              <button type="submit" className="btn btn-gold">
                Save
              </button>
              <p className="text-[11px] text-faint">
                staff/members visibility feeds the staff portal and member app as those surfaces land.
              </p>
            </div>
          </form>
        </section>

        {isDoc && (
          <section className="panel mt-5 p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="label">Publishing — HTML KB</p>
              {published ? (
                <span className="chip chip-green">
                  published · {published.template} · {fmtDate(published.created_at)}
                </span>
              ) : (
                <span className="chip chip-gold">draft only — not published</span>
              )}
            </div>

            <div className="grid grid-cols-[1fr_320px] gap-5">
              <div>
                {/* Publish current content */}
                <form action={publishNodeAction} className="flex items-end gap-3">
                  <input type="hidden" name="id" value={node.id} />
                  <div>
                    <label className="label">Template</label>
                    <select name="template" defaultValue={published?.template || "article"} className="input">
                      <option value="article">Article</option>
                      <option value="brief">Brief</option>
                      <option value="deck">Deck</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Accent</label>
                    <input name="accent" className="input w-28" placeholder="#b8925a" />
                  </div>
                  <button type="submit" className="btn btn-gold">
                    Render &amp; publish
                  </button>
                </form>
                <p className="mt-2 text-[11px] text-faint">
                  Renders the markdown above into an immutable, sanitized HTML revision and points
                  the doc at it. Agents can draft revisions via MCP; publishing is operator-only.
                </p>

                {revisions.length > 0 && (
                  <div className="mt-4">
                    <p className="label mb-1">Revisions</p>
                    <ul className="text-[12px] text-muted">
                      {revisions.map((r) => (
                        <li key={r.id} className="flex items-center gap-2 py-0.5">
                          <span className={r.id === published?.id ? "text-green" : ""}>
                            {r.id === published?.id ? "● " : "○ "}
                            {r.template}
                          </span>
                          <span className="text-faint">{fmtDate(r.created_at)}</span>
                          <code className="text-faint">{r.content_hash.slice(0, 10)}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Tree grants */}
                <div className="mt-5">
                  <p className="label mb-1">Who can read this subtree</p>
                  <div className="flex flex-wrap gap-2">
                    {AUDIENCES.map(([aud, lbl]) => {
                      const on = grantedAudiences.has(aud);
                      return (
                        <form action={setGrantAction} key={aud}>
                          <input type="hidden" name="id" value={node.id} />
                          <input type="hidden" name="audience" value={aud} />
                          <input type="hidden" name="on" value={on ? "false" : "true"} />
                          <button
                            type="submit"
                            className={`rounded-md border px-2.5 py-1.5 text-[12px] ${
                              on ? "border-gold/60 bg-gold/10 text-gold" : "border-line text-muted"
                            }`}
                          >
                            {on ? "✓ " : "+ "}
                            {lbl}
                          </button>
                        </form>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-faint">
                    Grants inherit to child pages. Default is deny.
                  </p>
                </div>
              </div>

              {/* External shares */}
              <aside>
                <p className="label mb-1">External share</p>
                <ShareCreator nodeId={node.id} canShare={!!published} />
                {shares.length > 0 && (
                  <div className="mt-3">
                    <p className="label mb-1">Active links</p>
                    <ul className="space-y-1">
                      {shares.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 text-[12px]">
                          <span className={s.revoked_at ? "text-faint line-through" : "text-muted"}>
                            {s.recipient_label} · {s.token_prefix}… · {s.view_count} views
                          </span>
                          {!s.revoked_at && (
                            <form action={revokeShareAction}>
                              <input type="hidden" name="id" value={node.id} />
                              <input type="hidden" name="shareId" value={s.id} />
                              <button type="submit" className="text-red hover:underline">
                                revoke
                              </button>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </aside>
            </div>
          </section>
        )}

        {node.kind === "folder" && (
          <section className="panel mt-5 p-5">
            <p className="label">New inside “{node.title}”</p>
            <form action={createKbNodeAction} className="flex items-end gap-3">
              <input type="hidden" name="parentId" value={node.id} />
              <input type="hidden" name="path" value={`/kb/${node.id}`} />
              <div className="flex-1">
                <label className="label">Title</label>
                <input name="title" required className="input" />
              </div>
              <div>
                <label className="label">Kind</label>
                <select name="kind" className="input">
                  <option value="doc">Doc</option>
                  <option value="folder">Folder</option>
                </select>
              </div>
              <div>
                <label className="label">Visible to</label>
                <select name="visibility" className="input" defaultValue={node.visibility}>
                  <option value="internal">Operators</option>
                  <option value="staff">Staff</option>
                  <option value="members">Members</option>
                </select>
              </div>
              <button type="submit" className="btn">
                Create
              </button>
            </form>
          </section>
        )}

        <section className="panel mt-5 flex items-center justify-between p-4">
          <p className="text-[12px] text-faint">
            Archiving hides this {node.kind} (and its children) everywhere without deleting it.
          </p>
          <form action={archiveKbNodeAction}>
            <input type="hidden" name="id" value={node.id} />
            <input type="hidden" name="archived" value="true" />
            <button type="submit" className="btn btn-red">
              Archive
            </button>
          </form>
        </section>
      </KbShell>
    </>
  );
}
