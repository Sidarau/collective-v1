import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions, type SessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";

export const runtime = "nodejs";

const MAX_BYTES = 6 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

/** POST multipart {file} → media bucket avatars/<user>/<ts>.<ext> → profiles.avatar_url */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as SessionUser;

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }
    const ext = TYPES[file.type];
    if (!ext) {
      return NextResponse.json({ error: "Use a JPEG, PNG, WebP, or HEIC photo" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Photos are limited to 6 MB" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const path = `avatars/${user.id}/${Date.now()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
    const url = pub.publicUrl;

    const { error: updateError } = await supabase
      .from("profiles")
      .upsert({ user_id: user.id, avatar_url: url }, { onConflict: "user_id" });
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
