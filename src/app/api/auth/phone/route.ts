import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@core/supabase";
import { verifyFirebasePhoneToken } from "@core/firebase-verify";
import { mintSession } from "@core/session";

export const runtime = "nodejs";

/**
 * Phone login: client completes Firebase SMS OTP → posts the ID token here →
 * we verify it against Google's keys and mint the normal NextAuth session for
 * the account linked to that number. Unknown numbers holding a live phone
 * invite are routed into /welcome/[token] instead.
 */
export async function POST(req: NextRequest) {
  try {
    const { idToken } = (await req.json()) as { idToken?: string };
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const verified = await verifyFirebasePhoneToken(idToken);
    if (!verified) {
      return NextResponse.json({ error: "Phone verification failed" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase
      .from("users")
      .select("id, email, role, lead_id, phone_verified")
      .eq("phone", verified.phone)
      .maybeSingle();

    if (user) {
      if (!user.phone_verified) {
        await supabase.from("users").update({ phone_verified: true }).eq("id", user.id);
      }
      const minted = await mintSession(user);
      const res = NextResponse.json({ success: true, destination: "/enter" });
      res.cookies.set({ name: minted.cookie.name, value: minted.sessionJwt, ...minted.cookie.options });
      return res;
    }

    // Not linked yet — do they hold a live invite for this number?
    const { data: invite } = await supabase
      .from("invite_tokens")
      .select("token")
      .eq("phone", verified.phone)
      .is("used_at", null)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (invite) {
      return NextResponse.json({ success: true, destination: `/welcome/${invite.token}` });
    }

    return NextResponse.json(
      { error: "This number isn't linked to the Circle yet. Enter with your email, or ask your host for an invitation." },
      { status: 404 }
    );
  } catch (error) {
    console.error("Phone login error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
