import { getSupabaseAdmin } from "./supabase";
import type { CrmEntityType, Json } from "./database.types";

export interface AuditParams {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string; // dot-namespaced, e.g. "application.approve"
  entityType: CrmEntityType;
  entityId?: string | null;
  summary?: string;
  meta?: Record<string, Json | undefined>;
}

/**
 * Every admin decision leaves a trail. Failures are logged but never block
 * the action itself — an audit hiccup must not eat an approval.
 */
export async function writeAudit(params: AuditParams): Promise<void> {
  try {
    const { error } = await getSupabaseAdmin().from("audit_logs").insert({
      actor_id: params.actorId || null,
      actor_email: params.actorEmail || null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      summary: params.summary || null,
      meta: (params.meta as Json) || {},
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error(`[audit] failed for ${params.action}:`, err);
  }
}
