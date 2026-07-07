import { redirect } from "next/navigation";
import { getAdminUserWithPassword } from "@/lib/auth";
import SetupPasswordForm from "./SetupPasswordForm";

export const dynamic = "force-dynamic";

export default async function SetupPasswordPage() {
  const user = await getAdminUserWithPassword();
  if (!user) redirect("/login");
  if (user.hasPassword) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.24em] text-gold">
          Collective
        </p>
        <h1 className="mt-1 text-center text-xl font-semibold text-ink">Create your password</h1>
        <SetupPasswordForm email={user.email} />
      </div>
    </main>
  );
}
