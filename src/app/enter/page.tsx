import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { resolveDestination } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Post-login switchboard: sends each user to their current place in the flow. */
export default async function EnterPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  redirect(await resolveDestination(user));
}
