import { NextResponse } from "next/server";
import { upsertKbNode } from "@core/kb";
import type { KbVisibility } from "@core/database.types";
import { requireAgentOrAdmin } from "@/lib/agent-auth";

export const runtime = "nodejs";

interface CreateBody {
  title?: string;
  parentId?: string | null;
  kind?: "folder" | "doc";
  bodyMd?: string;
  visibility?: KbVisibility;
}

/** Create a KB node. Agents use this to write SOPs/docs. */
export async function POST(req: Request) {
  const denied = await requireAgentOrAdmin(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as CreateBody;
    if (!body.title) return NextResponse.json({ error: "title is required" }, { status: 400 });
    const node = await upsertKbNode({
      title: body.title,
      parentId: body.parentId || null,
      kind: body.kind === "folder" ? "folder" : "doc",
      bodyMd: body.bodyMd || "",
      visibility: body.visibility,
    });
    return NextResponse.json({ node }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Create failed" },
      { status: 500 }
    );
  }
}
