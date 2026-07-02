import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, type SessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";

export const runtime = "nodejs";

/**
 * Completes onboarding for an approved member: upserts their profile
 * (pre-filled client-side from the application) and marks it complete.
 */
export async function POST(req: NextRequest) {
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

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        first_name: body.firstName,
        last_name: body.lastName,
        headline: body.headline || null,
        location: body.location || null,
        bio: body.bio || null,
        contribution: body.contribution || null,
        phone: body.phone || null,
        whatsapp: body.whatsapp || null,
        allergies: body.allergies || null,
        dietary: body.dietary || null,
        onboarding_completed: true,
      },
      { onConflict: "user_id" }
    );

    if (error) throw new Error(error.message);

    // Mirror stay-critical details onto the lead row for operations.
    if (user.leadId) {
      await supabase
        .from("leads")
        .update({
          dietary_restrictions:
            [body.allergies, body.dietary].filter(Boolean).join(" · ") || null,
          phone: body.phone || null,
          whatsapp: body.whatsapp || null,
        })
        .eq("id", user.leadId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save" },
      { status: 500 }
    );
  }
}
