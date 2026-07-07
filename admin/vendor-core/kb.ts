import { getSupabaseAdmin } from "./supabase";
import type { KbNodeRow, KbVisibility } from "./database.types";

/**
 * Knowledge base primitives shared by the console UI, the REST agent API,
 * and the MCP endpoint. One table (`kb_nodes`), tree by parent_id.
 */

export interface KbTreeNode extends KbNodeRow {
  children: KbTreeNode[];
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "untitled"
  );
}

export function buildKbTree(nodes: KbNodeRow[]): KbTreeNode[] {
  const byId = new Map<string, KbTreeNode>(nodes.map((n) => [n.id, { ...n, children: [] }]));
  const roots: KbTreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortRec = (list: KbTreeNode[]) => {
    list.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

export async function listKbNodes(opts?: {
  includeArchived?: boolean;
  visibility?: KbVisibility[];
}): Promise<KbNodeRow[]> {
  let query = getSupabaseAdmin().from("kb_nodes").select("*").order("position");
  if (!opts?.includeArchived) query = query.eq("archived", false);
  if (opts?.visibility?.length) query = query.in("visibility", opts.visibility);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as KbNodeRow[]) || [];
}

export async function getKbNode(id: string): Promise<KbNodeRow | null> {
  const { data } = await getSupabaseAdmin().from("kb_nodes").select("*").eq("id", id).maybeSingle();
  return (data as KbNodeRow) || null;
}

export interface KbUpsertInput {
  id?: string;
  parentId?: string | null;
  kind?: "folder" | "doc";
  title?: string;
  bodyMd?: string;
  visibility?: KbVisibility;
  position?: number;
  archived?: boolean;
  updatedBy?: string | null;
}

export async function upsertKbNode(input: KbUpsertInput): Promise<KbNodeRow> {
  const supabase = getSupabaseAdmin();
  if (input.id) {
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) {
      patch.title = input.title;
      patch.slug = slugify(input.title);
    }
    if (input.bodyMd !== undefined) patch.body_md = input.bodyMd;
    if (input.visibility !== undefined) patch.visibility = input.visibility;
    if (input.parentId !== undefined) patch.parent_id = input.parentId;
    if (input.position !== undefined) patch.position = input.position;
    if (input.archived !== undefined) patch.archived = input.archived;
    if (input.updatedBy !== undefined) patch.updated_by = input.updatedBy;
    const { data, error } = await supabase
      .from("kb_nodes")
      .update(patch)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message || "KB update failed");
    return data as KbNodeRow;
  }

  const title = input.title || "Untitled";
  const { data, error } = await supabase
    .from("kb_nodes")
    .insert({
      parent_id: input.parentId || null,
      kind: input.kind || "doc",
      title,
      slug: slugify(title),
      body_md: input.bodyMd || "",
      visibility: input.visibility || "internal",
      position: input.position ?? 999,
      updated_by: input.updatedBy || null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "KB create failed");
  return data as KbNodeRow;
}

export async function searchKb(term: string, limit = 20): Promise<KbNodeRow[]> {
  const escaped = term.replace(/[%_]/g, "\\$&");
  const { data, error } = await getSupabaseAdmin()
    .from("kb_nodes")
    .select("*")
    .eq("archived", false)
    .or(`title.ilike.%${escaped}%,body_md.ilike.%${escaped}%`)
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as KbNodeRow[]) || [];
}

/** Breadcrumb path for a node (root → node). */
export function kbPath(nodes: KbNodeRow[], id: string): KbNodeRow[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path: KbNodeRow[] = [];
  let current = byId.get(id);
  while (current) {
    path.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return path;
}
