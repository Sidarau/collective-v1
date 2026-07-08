import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, type SessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as SessionUser;
    if (user.role === "lead") {
      return NextResponse.json({ error: "Membership pending" }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, string>;
    if (!body.firstName || !body.lastName) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin().from("profiles").upsert(
      {
        user_id: user.id,
        first_name: body.firstName,
        last_name: body.lastName,
        headline: body.headline || null,
        location: body.location || null,
        bio: body.bio || null,
        contribution: body.contribution || null,
        allergies: body.allergies || null,
        dietary: body.dietary || null,
        phone: body.phone || null,
        whatsapp: body.whatsapp || null,
      },
      { onConflict: "user_id" }
    );
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile save error:", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
