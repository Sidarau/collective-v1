"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { upsertKbNode } from "@core/kb";
import { writeAudit } from "@core/audit";
import type { KbVisibility } from "@core/database.types";
import { getAdminUser } from "./auth";

async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Not authorized");
  return admin;
}

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

const visibilityOf = (raw: string): KbVisibility =>
  raw === "staff" || raw === "members" ? raw : "internal";

export async function createKbNodeAction(formData: FormData) {
  const admin = await requireAdmin();
  const title = str(formData, "title");
  const parentId = str(formData, "parentId") || null;
  const kind = str(formData, "kind") === "folder" ? "folder" : "doc";
  const backPath = str(formData, "path") || "/kb";
  if (!title) redirect(`${backPath}?error=${encodeURIComponent("Give it a title")}`);

  let nodeId = "";
  try {
    const node = await upsertKbNode({
      title,
      parentId,
      kind,
      visibility: visibilityOf(str(formData, "visibility")),
      updatedBy: admin.id,
    });
    nodeId = node.id;
    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "kb.create",
      entityType: "kb_node",
      entityId: node.id,
      summary: `KB ${kind} "${title}" created`,
    });
  } catch (err) {
    redirect(
      `${backPath}?error=${encodeURIComponent(err instanceof Error ? err.message : "Create failed")}`
    );
  }
  revalidatePath("/kb");
  redirect(`/kb/${nodeId}`);
}

export async function saveKbNodeAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const path = `/kb/${id}`;

  try {
    const node = await upsertKbNode({
      id,
      title: str(formData, "title") || "Untitled",
      bodyMd: String(formData.get("body") ?? ""),
      visibility: visibilityOf(str(formData, "visibility")),
      parentId: str(formData, "parentId") || null,
      position: parseInt(str(formData, "position"), 10) || 0,
      updatedBy: admin.id,
    });
    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "kb.update",
      entityType: "kb_node",
      entityId: id,
      summary: `KB "${node.title}" saved (${node.visibility})`,
    });
  } catch (err) {
    redirect(`${path}?error=${encodeURIComponent(err instanceof Error ? err.message : "Save failed")}`);
  }
  revalidatePath("/kb");
  revalidatePath(path);
  redirect(path);
}

export async function archiveKbNodeAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const archived = str(formData, "archived") === "true";

  await upsertKbNode({ id, archived, updatedBy: admin.id });
  await writeAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: archived ? "kb.archive" : "kb.restore",
    entityType: "kb_node",
    entityId: id,
    summary: archived ? "KB node archived" : "KB node restored",
  });
  revalidatePath("/kb");
  redirect(archived ? "/kb" : `/kb/${id}`);
}
