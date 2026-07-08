import Link from "next/link";
import { fetchMembers } from "@/lib/data";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const members = await fetchMembers();

  return (
    <div className="px-5 pt-14">
      <header className="reveal">
        <p className="eyebrow">Members</p>
        <h1 className="display mt-2 text-[32px] leading-tight text-ink">The Circle</h1>
        <p className="muted mt-2 text-[14px]">
          {members.length} member{members.length === 1 ? "" : "s"} · introductions through the concierge
        </p>
      </header>

      <div className="stagger mt-6 space-y-3">
        {members.map((m) => (
          <Link
            key={m.id}
            href={`/app/members/${m.user_id}`}
            className="glass tap flex items-center gap-4 p-4"
          >
            <Avatar url={m.avatar_url} first={m.first_name} last={m.last_name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-ink">
                {m.first_name} {m.last_name}
              </p>
              <p className="muted truncate text-[13px]">{m.headline || "Member"}</p>
              {m.location && <p className="faint truncate text-[12px]">{m.location}</p>}
            </div>
            {m.users?.role !== "member" && <span className="chip chip-gold">Host</span>}
            <span className="muted">›</span>
          </Link>
        ))}
        {members.length === 0 && (
          <p className="muted glass-flat p-4 text-[13px]">The directory is filling in.</p>
        )}
      </div>
    </div>
  );
}
