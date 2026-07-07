import { NextRequest, NextResponse } from "next/server";
import { sendNotificationEmail } from "@core/email";
import { config } from "@core/config";
import { getSupabaseAdmin } from "@core/supabase";

export const runtime = "nodejs";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const name = clean(body.name);
    const email = clean(body.email).toLowerCase();
    const roleApplied = clean(body.roleApplied);

    if (!name || !email || !roleApplied) {
      return NextResponse.json(
        { error: "Name, email, and role are required." },
        { status: 400 }
      );
    }

    const { data, error } = await getSupabaseAdmin()
      .from("staff_applications")
      .insert({
        name,
        email,
        phone: clean(body.phone) || null,
        role_applied: roleApplied,
        experience: clean(body.experience) || null,
        links: clean(body.links) ? { raw: clean(body.links) } : {},
        message: clean(body.message) || null,
        status: "submitted",
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Failed to save staff application");
    }

    if (config.adminEmail) {
      try {
        await sendNotificationEmail({
          to: config.adminEmail,
          subject: `Staff application: ${name}`,
          heading: "New staff application",
          body: `${name} applied for ${roleApplied}. Review it in the operator console.`,
          ctaHref: config.adminUrl || undefined,
          ctaLabel: "Open console",
        });
      } catch (err) {
        console.error("Staff notification failed:", err);
      }
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error("Staff application error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit" },
      { status: 500 }
    );
  }
}
