import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ErrorBanner from "@/components/ErrorBanner";
import { buildKbTree, getKbNode, kbPath, listKbNodes } from "@core/kb";
import { fmtDate } from "@/lib/format";
import { archiveKbNodeAction, createKbNodeAction, saveKbNodeAction } from "@/lib/kb-actions";
import KbShell from "../KbShell";

export const dynamic = "force-dynamic";

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
