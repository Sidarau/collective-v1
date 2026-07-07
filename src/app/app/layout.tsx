import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { fetchProfileByUserId } from "@/lib/data";
import TabBar from "@/components/TabBar";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (user.role === "lead") redirect("/enter");

  if (user.role === "member") {
    const profile = await fetchProfileByUserId(user.id);
    if (!profile?.onboarding_completed) redirect("/onboarding");
  }

  return (
    <div className="relative min-h-dvh bg-base">
      {/* Quiet atmospheric depth behind every portal screen */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(120% 60% at 80% -10%, rgba(228,190,109,0.10) 0%, rgba(228,190,109,0) 60%), radial-gradient(90% 50% at 0% 100%, rgba(117,169,146,0.10) 0%, rgba(117,169,146,0) 55%)",
        }}
      />
      <div className="relative mx-auto w-full max-w-md safe-b md:max-w-2xl">
        {children}
      </div>
      <TabBar />
    </div>
  );
}
