import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, type SessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";
import { verifyFirebasePhoneToken } from "@core/firebase-verify";

export const runtime = "nodejs";

/** Link a Firebase-verified phone number to the signed-in account. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = session.user as SessionUser;

    const { idToken } = (await req.json()) as { idToken?: string };
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const verified = await verifyFirebasePhoneToken(idToken);
    if (!verified) return NextResponse.json({ error: "Phone verification failed" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const { data: taken } = await supabase
      .from("users")
      .select("id")
      .eq("phone", verified.phone)
      .neq("id", user.id)
      .maybeSingle();
    if (taken) {
      return NextResponse.json(
        { error: "That number is already linked to another account" },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("users")
      .update({ phone: verified.phone, phone_verified: true })
      .eq("id", user.id);
    if (error) throw new Error(error.message);

    // Keep the member-visible profile contact in sync.
    await supabase
      .from("profiles")
      .update({ phone: verified.phone, whatsapp: verified.phone })
      .eq("user_id", user.id);

    return NextResponse.json({ success: true, phone: verified.phone });
  } catch (error) {
    console.error("Phone link error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
