import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { renderRevision, RENDERER_VERSION, type KbTemplate } from "./kb-render";
import type { KbRevisionRow, KbTemplateName } from "./database.types";

/**
 * Revision lifecycle (ADR §3.5). Revisions are append-only: drafting renders +
 * hashes markdown into a new immutable row; publishing only moves the node's
 * `published_revision_id` pointer. Nothing is edited in place.
 */

export interface CreateRevisionInput {
  nodeId: string;
  markdown: string;
  template?: KbTemplate;
  theme?: Record<string, unknown>;
  sourceRef?: string | null;
  authorId?: string | null;
  authorEmail?: string | null;
}

/** Render + sanitize + hash + insert a new immutable revision. Does NOT publish. */
export async function createRevision(input: CreateRevisionInput): Promise<KbRevisionRow> {
  const template = (input.template ?? "article") as KbTemplate;
  const rendered = renderRevision(input.markdown, template);
  const { data, error } = await getSupabaseAdmin()
    .from("kb_revisions")
    .insert({
      node_id: input.nodeId,
      markdown: input.markdown,
      html: rendered.html,
      template: template as KbTemplateName,
      theme: (input.theme ?? {}) as never,
      content_hash: rendered.contentHash,
      renderer_version: RENDERER_VERSION,
      source_ref: input.sourceRef ?? null,
      author_id: input.authorId ?? null,
      author_email: input.authorEmail ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Revision create failed");
  return data as KbRevisionRow;
}

export async function getRevision(id: string): Promise<KbRevisionRow | null> {
  const { data } = await getSupabaseAdmin().from("kb_revisions").select("*").eq("id", id).maybeSingle();
  return (data as KbRevisionRow) || null;
}

export async function listRevisions(nodeId: string, limit = 20): Promise<KbRevisionRow[]> {
  const { data } = await getSupabaseAdmin()
    .from("kb_revisions")
    .select("*")
    .eq("node_id", nodeId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as KbRevisionRow[]) || [];
}

/**
 * Point a node at a revision (publish). Human-gated at the call site — this
 * function performs no capability check itself; callers must have already
 * passed `authorize(principal, "kb.publish", …)`.
 */
export async function publishRevision(nodeId: string, revisionId: string): Promise<void> {
  const rev = await getRevision(revisionId);
  if (!rev || rev.node_id !== nodeId) throw new Error("Revision does not belong to node");
  const { error } = await getSupabaseAdmin()
    .from("kb_nodes")
    .update({ published_revision_id: revisionId })
    .eq("id", nodeId);
  if (error) throw new Error(error.message);
}

export async function getPublishedRevision(nodeId: string): Promise<KbRevisionRow | null> {
  const { data: node } = await getSupabaseAdmin()
    .from("kb_nodes")
    .select("published_revision_id")
    .eq("id", nodeId)
    .maybeSingle();
  const revId = (node as { published_revision_id: string | null } | null)?.published_revision_id;
  if (!revId) return null;
  return getRevision(revId);
}
