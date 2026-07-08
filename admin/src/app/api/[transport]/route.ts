import { createMcpHandler } from "mcp-handler";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildKbTree, getKbNode, listKbNodes, searchKb, upsertKbNode } from "@core/kb";
import { writeAudit } from "@core/audit";
import { getSupabaseAdmin } from "@core/supabase";
import { agentContext, resolveAgent } from "@/lib/agent-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * MCP endpoint for agents (Claude, Hermes, Codex…): the Collective knowledge
 * base as tools, so the swarm can read and write SOPs without the console UI.
 * Auth: Authorization: Bearer AGENT_API_TOKEN (see Settings).
 */
const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "kb_tree",
      {
        title: "Knowledge base tree",
        description:
          "Full Collective OS knowledge-base tree (folders and docs with ids, titles, visibility). Bodies are omitted — fetch a doc with kb_get.",
        inputSchema: {},
      },
      async () => {
        const nodes = await listKbNodes();
        const strip = (list: ReturnType<typeof buildKbTree>): unknown[] =>
          list.map((n) => ({
            id: n.id,
            kind: n.kind,
            title: n.title,
            visibility: n.visibility,
            children: strip(n.children),
          }));
        return {
          content: [{ type: "text", text: JSON.stringify(strip(buildKbTree(nodes)), null, 2) }],
        };
      }
    );

    server.registerTool(
      "kb_get",
      {
        title: "Read a knowledge-base doc",
        description: "Fetch one KB node by id, including its markdown body.",
        inputSchema: { id: z.string().uuid() },
      },
      async ({ id }) => {
        const node = await getKbNode(id);
        if (!node) return { content: [{ type: "text", text: "Not found" }], isError: true };
        return {
          content: [
            {
              type: "text",
              text: `# ${node.title}\n(id: ${node.id} · ${node.kind} · visibility: ${node.visibility})\n\n${node.body_md}`,
            },
          ],
        };
      }
    );

    server.registerTool(
      "kb_search",
      {
        title: "Search the knowledge base",
        description: "Case-insensitive search over titles and bodies. Returns matching nodes.",
        inputSchema: { query: z.string().min(2) },
      },
      async ({ query }) => {
        const nodes = await searchKb(query);
        return {
          content: [
            {
              type: "text",
              text: nodes.length
                ? nodes.map((n) => `- ${n.title} (id: ${n.id}, ${n.kind}, ${n.visibility})`).join("\n")
                : "No matches.",
            },
          ],
        };
      }
    );

    server.registerTool(
      "kb_upsert",
      {
        title: "Create or update a knowledge-base doc",
        description:
          "Create a doc/folder (omit id) or update one (pass id). Markdown body. visibility: internal | staff | members.",
        inputSchema: {
          id: z.string().uuid().optional(),
          title: z.string().optional(),
          bodyMd: z.string().optional(),
          parentId: z.string().uuid().nullable().optional(),
          kind: z.enum(["folder", "doc"]).optional(),
          visibility: z.enum(["internal", "staff", "members"]).optional(),
        },
      },
      async (input) => {
        const node = await upsertKbNode(input);
        // Attribution: every agent write lands in the audit trail under the
        // admin whose token performed it (see Agents & MCP in the console).
        const who = agentContext.getStore();
        await writeAudit({
          actorId: who?.adminId || null,
          actorEmail: who?.adminEmail || "agent",
          action: "agent.kb_upsert",
          entityType: "event", // closest CRM bucket for kb entities is not modeled; keep feed-visible
          entityId: null,
          summary: `${who?.tokenLabel ? `[${who.tokenLabel}] ` : ""}saved KB doc "${node.title}"`,
          meta: { kb_node_id: node.id, via: who?.kind || "unknown" },
        });
        return {
          content: [{ type: "text", text: `Saved "${node.title}" (id: ${node.id})` }],
        };
      }
    );

    server.registerTool(
      "leads_search",
      {
        title: "Search leads",
        description:
          "Search Collective leads by name/email/phone/source/status. Returns private operator CRM context; do not expose it to members.",
        inputSchema: {
          query: z.string().optional(),
          status: z.enum(["new", "active", "inactive", "blacklisted"]).optional(),
          limit: z.number().int().min(1).max(50).optional(),
        },
      },
      async ({ query, status, limit }) => {
        const supabase = getSupabaseAdmin();
        let request = supabase
          .from("leads")
          .select("id, email, first_name, last_name, phone, whatsapp, source, status, notes, created_at, updated_at")
          .order("updated_at", { ascending: false })
          .limit(limit || 20);

        if (status) request = request.eq("status", status);
        const q = query?.trim();
        if (q) {
          const like = `%${q.replace(/[%,]/g, "")}%`;
          request = request.or(
            `email.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like},whatsapp.ilike.${like},source.ilike.${like}`
          );
        }

        const { data, error } = await request;
        if (error) return { content: [{ type: "text", text: error.message }], isError: true };
        const rows = (data || []) as {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          whatsapp: string | null;
          source: string;
          status: string;
          notes: string | null;
          updated_at: string;
        }[];
        return {
          content: [
            {
              type: "text",
              text: rows.length
                ? rows
                    .map(
                      (l) =>
                        `- ${l.first_name} ${l.last_name} <${l.email}> — ${l.status}, ${l.source}, phone: ${l.phone || l.whatsapp || "n/a"}, updated: ${l.updated_at.slice(0, 10)}${l.notes ? `\n  note: ${l.notes.slice(0, 180)}` : ""}`
                    )
                    .join("\n")
                : "No leads matched.",
            },
          ],
        };
      }
    );

    server.registerTool(
      "operations_report",
      {
        title: "Operations status report",
        description:
          "High-level status report across applications, reservations, events, public guest RSVPs, and open follow-ups.",
        inputSchema: {
          daysAhead: z.number().int().min(1).max(180).optional(),
        },
      },
      async ({ daysAhead }) => {
        const supabase = getSupabaseAdmin();
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const until = new Date(now.getTime() + (daysAhead || 30) * 86400_000).toISOString();

        const [
          newLeads,
          activeLeads,
          submittedApps,
          screeningApps,
          pendingRequests,
          confirmedStays,
          upcomingEvents,
          publicEvents,
          guestGoing,
          guestWaitlist,
          openFollowUps,
          upcomingRequests,
        ] = await Promise.all([
          supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new"),
          supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "active"),
          supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "submitted"),
          supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "screening"),
          supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "requested"),
          supabase
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .in("status", ["approved", "deposit_paid", "paid", "confirmed"])
            .gte("check_out", today),
          supabase
            .from("events")
            .select("id", { count: "exact", head: true })
            .eq("status", "published")
            .gte("start_at", now.toISOString())
            .lte("start_at", until),
          supabase
            .from("events")
            .select("id", { count: "exact", head: true })
            .eq("status", "published")
            .eq("audience", "public")
            .gte("start_at", now.toISOString())
            .lte("start_at", until),
          supabase.from("event_guest_rsvps").select("id", { count: "exact", head: true }).eq("status", "going"),
          supabase.from("event_guest_rsvps").select("id", { count: "exact", head: true }).eq("status", "waitlist"),
          supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("status", "open"),
          supabase
            .from("bookings")
            .select("id, check_in, check_out, status, guest_names, companion_name")
            .gte("check_out", today)
            .order("check_in", { ascending: true })
            .limit(5),
        ]);

        const report = [
          `# Collective Operations Report`,
          ``,
          `Window: next ${daysAhead || 30} days`,
          ``,
          `## Funnel`,
          `- Leads: ${newLeads.count || 0} new, ${activeLeads.count || 0} active`,
          `- Applications: ${submittedApps.count || 0} submitted, ${screeningApps.count || 0} in screening`,
          `- Open follow-ups: ${openFollowUps.count || 0}`,
          ``,
          `## Reservations`,
          `- Pending stay requests: ${pendingRequests.count || 0}`,
          `- Upcoming approved/confirmed stays: ${confirmedStays.count || 0}`,
          ...(((upcomingRequests.data as { id: string; check_in: string; check_out: string; status: string }[]) || []).length
            ? [
                `- Next stays:`,
                ...((upcomingRequests.data as { id: string; check_in: string; check_out: string; status: string }[]) || []).map(
                  (b) => `  - ${b.check_in} -> ${b.check_out}: ${b.status} (${b.id})`
                ),
              ]
            : []),
          ``,
          `## Events`,
          `- Upcoming published events: ${upcomingEvents.count || 0}`,
          `- Public guest events: ${publicEvents.count || 0}`,
          `- Public guest RSVPs: ${guestGoing.count || 0} going, ${guestWaitlist.count || 0} waitlisted`,
        ].join("\n");

        return { content: [{ type: "text", text: report }] };
      }
    );
  },
  {},
  {
    basePath: "/api", // route lives at app/api/[transport] → endpoint is /api/mcp
    maxDuration: 60,
  }
);

async function authed(req: Request) {
  const identity = await resolveAgent(req);
  if (identity instanceof NextResponse) return identity;
  return agentContext.run(identity, () => handler(req));
}

export { authed as GET, authed as POST, authed as DELETE };
