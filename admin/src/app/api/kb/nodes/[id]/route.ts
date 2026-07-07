import { NextResponse } from "next/server";
import { getKbNode, upsertKbNode } from "@core/kb";
import type { KbVisibility } from "@core/database.types";
import { requireAgentOrAdmin } from "@/lib/agent-auth";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAgentOrAdmin(req);
  if (denied) return denied;

  const { id } = await ctx.params;
  const node = await getKbNode(id);
  if (!node) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ node });
}

interface PatchBody {
  title?: string;
  bodyMd?: string;
  visibility?: KbVisibility;
  parentId?: string | null;
  position?: number;
  archived?: boolean;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAgentOrAdmin(req);
  if (denied) return denied;

  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as PatchBody;
    const node = await upsertKbNode({
      id,
      title: body.title,
      bodyMd: body.bodyMd,
      visibility: body.visibility,
      parentId: body.parentId,
      position: body.position,
      archived: body.archived,
    });
    return NextResponse.json({ node });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
