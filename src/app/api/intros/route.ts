import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, type SessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";
import { sendNotificationEmail } from "@core/email";
import { config } from "@core/config";

export const runtime = "nodejs";

/** Member-to-member introduction request → concierge queue. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as SessionUser;
    if (!["member", "admin", "operator"].includes(user.role)) {
      return NextResponse.json({ error: "Membership required" }, { status: 403 });
    }

    const { toUserId, note } = (await req.json()) as { toUserId?: string; note?: string | null };
    if (!toUserId || toUserId === user.id) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: target } = await supabase
      .from("profiles")
      .select("first_name, visibility")
      .eq("user_id", toUserId)
      .maybeSingle();
    if (!target || target.visibility === "hidden") {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("intro_requests")
      .upsert(
        { from_user: user.id, to_user: toUserId, note: note || null },
        { onConflict: "from_user,to_user", ignoreDuplicates: true }
      );
    if (error) throw new Error(error.message);

    if (config.adminEmail) {
      try {
        await sendNotificationEmail({
          to: config.adminEmail,
          subject: "Intro request in the concierge queue",
          heading: "New introduction request",
          body: `${user.email} asked to be introduced to ${target.first_name}. ${note ? `Note: "${note}"` : ""}`,
          ctaHref: config.adminUrl || undefined,
          ctaLabel: "Open console",
        });
      } catch (err) {
        console.error("Intro notification failed:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Intro request error:", error);
    return NextResponse.json({ error: "Failed to send request" }, { status: 500 });
  }
}
