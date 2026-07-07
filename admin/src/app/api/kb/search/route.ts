import { NextRequest, NextResponse } from "next/server";
import { searchKb } from "@core/kb";
import { requireAgentOrAdmin } from "@/lib/agent-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = await requireAgentOrAdmin(req);
  if (denied) return denied;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });
  const nodes = await searchKb(q);
  return NextResponse.json({ nodes });
}
