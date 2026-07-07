import { redirect } from "next/navigation";
import { getAuthUserWithPassword } from "@/lib/auth";
import { resolveDestination } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Post-login switchboard: sends each user to their current place in the flow. */
export default async function EnterPage() {
  const user = await getAuthUserWithPassword();
  if (!user) redirect("/login");
  if (!user.hasPassword) redirect("/setup-password");
  redirect(await resolveDestination(user));
}
