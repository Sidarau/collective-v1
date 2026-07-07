import PageHeader from "@/components/PageHeader";
import ErrorBanner from "@/components/ErrorBanner";
import { buildKbTree, listKbNodes } from "@core/kb";
import { config } from "@core/config";
import { createKbNodeAction } from "@/lib/kb-actions";
import KbShell from "./KbShell";

export const dynamic = "force-dynamic";

export default async function KbIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const nodes = await listKbNodes();
  const tree = buildKbTree(nodes);
  const folders = nodes.filter((n) => n.kind === "folder");

  return (
    <>
      <PageHeader title="Knowledge base" eyebrow="Collective OS" />
      <ErrorBanner error={error} />
      <KbShell tree={tree}>
        <section className="panel p-5">
          <p className="label">New</p>
          <form action={createKbNodeAction} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="label">Title</label>
              <input name="title" required className="input" placeholder="Arrival SOP" />
            </div>
            <div>
              <label className="label">Kind</label>
              <select name="kind" className="input">
                <option value="doc">Doc</option>
                <option value="folder">Folder</option>
              </select>
            </div>
            <div>
              <label className="label">Inside</label>
              <select name="parentId" className="input">
                <option value="">Top level</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Visible to</label>
              <select name="visibility" className="input">
                <option value="internal">Operators</option>
                <option value="staff">Staff</option>
                <option value="members">Members</option>
              </select>
            </div>
            <button type="submit" className="btn btn-gold">
              Create
            </button>
          </form>
        </section>

        <section className="panel mt-5 p-5">
          <p className="label">Agents</p>
          <p className="text-[13px] text-muted">
            This knowledge base is the Notion replacement — agents read and write it over the KB
            API. Base URL: <code className="text-gold">{config.adminUrl || "<admin-url>"}/api/kb</code> with{" "}
            <code>Authorization: Bearer $AGENT_API_TOKEN</code>. MCP endpoint:{" "}
            <code className="text-gold">{config.adminUrl || "<admin-url>"}/api/mcp</code>.
          </p>
          <ul className="mt-3 space-y-1 text-[12px] text-faint">
            <li>
              <code>GET /api/kb/tree</code> — full tree · <code>GET /api/kb/search?q=</code> — find docs
            </li>
            <li>
              <code>GET /api/kb/nodes/:id</code> — read · <code>PATCH</code> — update ·{" "}
              <code>POST /api/kb/nodes</code> — create
            </li>
          </ul>
        </section>
      </KbShell>
    </>
  );
}
