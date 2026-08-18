import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import sharp from "sharp";
import { authOptions, type SessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@core/supabase";

export const runtime = "nodejs";

const MAX_BYTES = 6 * 1024 * 1024;
/** Accepted source formats; every upload is transcoded to JPEG on the way in. */
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

/** POST multipart {file} → sharp JPEG → media bucket avatars/<user>/<ts>.jpg → profiles.avatar_url */
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
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Use a JPEG, PNG, WebP, or HEIC photo" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Photos are limited to 6 MB" }, { status: 400 });
    }

    // Transcode to JPEG on the way in: HEIC (iPhone default) is unrenderable
    // by next/image and browsers, so storing the original byte-for-byte was
    // the silent-failure root cause for avatar uploads. A sharp failure must
    // abort here — never fall through to a raw store of the source.
    const source = Buffer.from(await file.arrayBuffer());
    const jpeg = await sharp(source)
      .rotate()
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const supabase = getSupabaseAdmin();
    const path = `avatars/${user.id}/${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(path, jpeg, { contentType: "image/jpeg", upsert: false });
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
