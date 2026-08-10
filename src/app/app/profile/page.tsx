import { getAuthUser } from "@/lib/auth";
import { fetchProfileByUserId } from "@/lib/data";
import { getOrCreatePersonalDoor } from "@/lib/referral-doors";
import { config } from "@core/config";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = (await getAuthUser())!;
  const profile = await fetchProfileByUserId(user.id);

  // Personal referral door: minted lazily on first view, persistent after.
  const canInvite = ["member", "admin", "operator"].includes(user.role);
  const door = canInvite ? await getOrCreatePersonalDoor(user.id) : null;
  const personalLinkUrl = door ? `${config.baseUrl.replace(/\/$/, "")}/r/${door.code}` : null;

  return (
    <div className="px-5 pt-14">
      <header className="reveal">
        <p className="eyebrow">Your profile</p>
        <h1 className="display mt-2 text-[32px] leading-tight text-ink">
          How the Circle sees you
        </h1>
        <p className="muted mt-2 text-[14px]">{user.email}</p>
      </header>

      <div className="reveal mt-6" style={{ animationDelay: "0.08s" }}>
        <ProfileForm
          initial={{
            firstName: profile?.first_name || "",
            lastName: profile?.last_name || "",
            headline: profile?.headline || "",
            location: profile?.location || "",
            bio: profile?.bio || "",
            contribution: profile?.contribution || "",
            allergies: profile?.allergies || "",
            dietary: profile?.dietary || "",
            birthday: profile?.birthday || "",
            phone: profile?.phone || "",
            whatsapp: profile?.whatsapp || "",
          }}
          initialAvatarUrl={profile?.avatar_url || null}
          canInvite={canInvite}
          personalLinkUrl={personalLinkUrl}
        />
      </div>
    </div>
  );
}
