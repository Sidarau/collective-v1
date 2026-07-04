import Link from "next/link";
import type { KbTreeNode } from "@core/kb";

const VIS_CHIP: Record<string, string> = {
  internal: "",
  staff: "chip-gold",
  members: "chip-green",
};

function Branch({ nodes, activeId, depth }: { nodes: KbTreeNode[]; activeId?: string; depth: number }) {
  return (
    <ul className={depth > 0 ? "ml-3 border-l border-line pl-2" : ""}>
      {nodes.map((node) => (
        <li key={node.id}>
          <Link
            href={`/kb/${node.id}`}
            className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-white/5 ${
              node.id === activeId ? "bg-white/5 text-gold" : node.kind === "folder" ? "text-ink" : "text-muted"
            }`}
          >
            <span className="text-[11px]">{node.kind === "folder" ? "▸" : "·"}</span>
            <span className="min-w-0 flex-1 truncate">{node.title}</span>
            {node.visibility !== "internal" && (
              <span className={`chip ${VIS_CHIP[node.visibility]} hidden group-hover:inline-flex`}>
                {node.visibility}
              </span>
            )}
          </Link>
          {node.children.length > 0 && <Branch nodes={node.children} activeId={activeId} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

/** Two-pane KB shell: tree on the left, whatever the page renders on the right. */
export default function KbShell({
  tree,
  activeId,
  children,
}: {
  tree: KbTreeNode[];
  activeId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[280px_1fr] gap-5">
      <aside className="panel self-start p-3">
        {tree.length === 0 ? (
          <p className="px-2 py-3 text-[12px] text-faint">Empty — create the first folder below.</p>
        ) : (
          <Branch nodes={tree} activeId={activeId} depth={0} />
        )}
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
