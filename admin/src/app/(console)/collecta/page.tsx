import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { mintCollectaEmbed } from "@/lib/clawpanel";
import ClawpanelChat from "@/components/ClawpanelChat";

export const dynamic = "force-dynamic";

// /collecta — Don's (and Alex's) chat with Collecta. ClawPanel owns the
// conversation layer: this page only authenticates the admin, mints a
// short-lived embed token for them via ClawPanel's broker, and renders the
// <clawpanel-chat> web component. Threads, permissions, and attribution live
// in ClawPanel; the Operator MCP stays the only path into Collective data.
export default async function CollectaPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/login");

  const grant = await mintCollectaEmbed(admin.email);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm text-neutral-500 mb-2">
        The Collective's operator — works with your access level. Onboard members,
        verify staff/vendor work, trigger invites and emails, draft KB updates.
      </p>
      {grant ? (
        <ClawpanelChat grant={grant} />
      ) : (
        <div className="rounded-md border border-neutral-800 bg-neutral-950 px-4 py-6 text-sm text-neutral-400">
          Collecta isn't connected right now. (Chat backend not provisioned for
          your account — ask Alex to enable it.)
        </div>
      )}
    </div>
  );
}
