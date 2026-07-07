import { NextResponse } from "next/server";
import { buildKbTree, listKbNodes } from "@core/kb";
import { requireAgentOrAdmin } from "@/lib/agent-auth";

export const runtime = "nodejs";

/** Full KB tree (folders + docs, bodies included). */
export async function GET(req: Request) {
  const denied = await requireAgentOrAdmin(req);
  if (denied) return denied;

  const nodes = await listKbNodes();
  return NextResponse.json({ tree: buildKbTree(nodes), count: nodes.length });
}
