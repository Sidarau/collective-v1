import { createMcpHandler } from "mcp-handler";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildKbTree, getKbNode, listKbNodes, searchKb, upsertKbNode } from "@core/kb";
import { writeAudit } from "@core/audit";
import { getSupabaseAdmin } from "@core/supabase";
import { DEFAULT_TIMEZONE, zonedToUtc } from "@core/scheduling";
import type { CrmEntityType, Json } from "@core/database.types";
import { agentContext, resolveAgent } from "@/lib/agent-auth";

/** Accept ISO-with-offset ("2026-07-20T19:00:00+02:00" / "…Z") or villa
 *  wall-clock ("2026-07-20T19:00") — wall clock is read as Europe/Madrid. */
function parseWhen(input: string | undefined | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  return zonedToUtc(
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4]) * 60 + Number(m[5]),
    DEFAULT_TIMEZONE
  ).toISOString();
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

/** Every agent write is attributed to the admin whose token performed it. */
async function auditAgent(
  action: string,
  entityType: CrmEntityType,
  entityId: string | null,
  summary: string,
  meta?: Record<string, Json | undefined>
) {
  const who = agentContext.getStore();
  await writeAudit({
    actorId: who?.adminId || null,
    actorEmail: who?.adminEmail || "agent",
    action,
    entityType,
    entityId,
    summary: `${who?.tokenLabel ? `[${who.tokenLabel}] ` : ""}${summary}`,
    meta: { ...meta, via: who?.kind || "unknown" },
  });
}

const err = (text: string) => ({ content: [{ type: "text" as const, text }], isError: true });
const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });

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

    // ---------------------------------------------------------------- Writes
    // Everything below mutates the live product with no redeploy. Each write
    // is validated, audited under the calling admin's token, and visible in
    // the console (Agents & MCP → activity).

    server.registerTool(
      "event_upsert",
      {
        title: "Create or update an event",
        description:
          "Create an event (omit id; title + startAt required) or update one (pass id; only provided fields change). Times: ISO with offset, or villa wall-clock 'YYYY-MM-DDTHH:MM' read as Europe/Madrid. audience 'public' = guest-list event on the landing page; 'member' = members only. capacity is what members see; hardCapacity is the hidden RSVP ceiling.",
        inputSchema: {
          id: z.string().uuid().optional(),
          title: z.string().min(2).optional(),
          description: z.string().optional(),
          eventType: z.enum(["dinner", "experience", "session", "gathering", "wellness"]).optional(),
          audience: z.enum(["member", "public"]).optional(),
          startAt: z.string().optional(),
          endAt: z.string().optional(),
          capacity: z.number().int().positive().nullable().optional(),
          hardCapacity: z.number().int().positive().nullable().optional(),
          locationNote: z.string().nullable().optional(),
          image: z.string().url().nullable().optional(),
          status: z.enum(["draft", "published", "cancelled"]).optional(),
          gateSlug: z.string().optional(),
        },
      },
      async (input) => {
        const supabase = getSupabaseAdmin();
        const startAt = input.startAt !== undefined ? parseWhen(input.startAt) : undefined;
        if (input.startAt !== undefined && !startAt) return err("Could not parse startAt");
        const endAt = input.endAt !== undefined ? parseWhen(input.endAt) : undefined;

        let villaId: string | null | undefined;
        if (input.gateSlug) {
          const { data: gate } = await supabase.from("villas").select("id").eq("slug", input.gateSlug).maybeSingle();
          if (!gate) return err(`No gate with slug "${input.gateSlug}"`);
          villaId = gate.id;
        }

        const patch: Record<string, unknown> = {};
        if (input.title !== undefined) patch.title = input.title;
        if (input.description !== undefined) patch.description = input.description;
        if (input.eventType !== undefined) patch.event_type = input.eventType;
        if (input.audience !== undefined) patch.audience = input.audience;
        if (startAt !== undefined) patch.start_at = startAt;
        if (endAt !== undefined) patch.end_at = endAt;
        if (input.capacity !== undefined) patch.capacity = input.capacity;
        if (input.hardCapacity !== undefined) patch.hard_capacity = input.hardCapacity;
        if (input.locationNote !== undefined) patch.location_note = input.locationNote;
        if (input.image !== undefined) patch.image = input.image;
        if (input.status !== undefined) patch.status = input.status;
        if (villaId !== undefined) patch.villa_id = villaId;

        if (input.id) {
          const { data: current } = await supabase
            .from("events")
            .select("id, title, capacity, hard_capacity")
            .eq("id", input.id)
            .maybeSingle();
          if (!current) return err("Event not found");
          const cap = (patch.capacity ?? current.capacity) as number | null;
          const hard = (patch.hard_capacity ?? current.hard_capacity) as number | null;
          if (cap && hard && hard < cap) return err("hardCapacity cannot be lower than capacity");
          const { error } = await supabase.from("events").update(patch).eq("id", input.id);
          if (error) return err(error.message);
          await auditAgent("agent.event_update", "event", input.id, `updated event "${(patch.title as string) || current.title}"`);
          return ok(`Updated event ${input.id}`);
        }

        if (!input.title || !startAt) return err("Creating an event needs title and startAt");
        if (input.capacity && input.hardCapacity && input.hardCapacity < input.capacity) {
          return err("hardCapacity cannot be lower than capacity");
        }
        const { data: created, error } = await supabase
          .from("events")
          .insert({
            title: input.title,
            slug: `${slugify(input.title)}-${Date.now().toString(36).slice(-4)}`,
            description: input.description || null,
            event_type: input.eventType || "gathering",
            audience: input.audience || "member",
            start_at: startAt,
            end_at: endAt || null,
            capacity: input.capacity ?? null,
            hard_capacity: input.hardCapacity ?? null,
            location_note: input.locationNote || null,
            image: input.image || null,
            status: input.status || "draft",
            villa_id: villaId ?? null,
          })
          .select("id, slug")
          .single();
        if (error || !created) return err(error?.message || "Create failed");
        await auditAgent("agent.event_create", "event", created.id, `created event "${input.title}" (${input.status || "draft"})`);
        return ok(`Created event "${input.title}" — id ${created.id}, slug ${created.slug}. Draft until status is 'published'.`);
      }
    );

    server.registerTool(
      "gate_update",
      {
        title: "Update a gate (villa) presentation",
        description:
          "Update content fields of a gate by slug. Only provided fields change. status: published | coming_soon | archived.",
        inputSchema: {
          gateSlug: z.string(),
          name: z.string().optional(),
          tagline: z.string().nullable().optional(),
          story: z.string().nullable().optional(),
          description: z.string().nullable().optional(),
          region: z.string().nullable().optional(),
          heroImage: z.string().url().nullable().optional(),
          amenities: z.array(z.string()).optional(),
          status: z.enum(["published", "coming_soon", "archived"]).optional(),
          maxGuests: z.number().int().positive().optional(),
        },
      },
      async (input) => {
        const supabase = getSupabaseAdmin();
        const { data: gate } = await supabase.from("villas").select("id, name").eq("slug", input.gateSlug).maybeSingle();
        if (!gate) return err(`No gate with slug "${input.gateSlug}"`);

        const patch: Record<string, unknown> = {};
        if (input.name !== undefined) patch.name = input.name;
        if (input.tagline !== undefined) patch.tagline = input.tagline;
        if (input.story !== undefined) patch.story = input.story;
        if (input.description !== undefined) patch.description = input.description;
        if (input.region !== undefined) patch.region = input.region;
        if (input.heroImage !== undefined) patch.hero_image = input.heroImage;
        if (input.amenities !== undefined) patch.amenities = input.amenities;
        if (input.status !== undefined) patch.status = input.status;
        if (input.maxGuests !== undefined) patch.max_guests = input.maxGuests;
        if (Object.keys(patch).length === 0) return err("Nothing to update");

        const { error } = await supabase.from("villas").update(patch).eq("id", gate.id);
        if (error) return err(error.message);
        await auditAgent("agent.gate_update", "villa", gate.id, `updated gate "${gate.name}" (${Object.keys(patch).join(", ")})`);
        return ok(`Updated ${gate.name}: ${Object.keys(patch).join(", ")}`);
      }
    );

    server.registerTool(
      "room_update",
      {
        title: "Update a room",
        description:
          "Update a room by gateSlug + roomSlug. priceEur is per night in whole euros. Only provided fields change.",
        inputSchema: {
          gateSlug: z.string(),
          roomSlug: z.string(),
          name: z.string().optional(),
          description: z.string().nullable().optional(),
          bedType: z.string().nullable().optional(),
          priceEur: z.number().int().positive().optional(),
          images: z.array(z.string().url()).optional(),
          amenities: z.array(z.string()).optional(),
        },
      },
      async (input) => {
        const supabase = getSupabaseAdmin();
        const { data: gate } = await supabase.from("villas").select("id").eq("slug", input.gateSlug).maybeSingle();
        if (!gate) return err(`No gate with slug "${input.gateSlug}"`);
        const { data: room } = await supabase
          .from("rooms")
          .select("id, name")
          .eq("villa_id", gate.id)
          .eq("slug", input.roomSlug)
          .maybeSingle();
        if (!room) return err(`No room "${input.roomSlug}" at that gate`);

        const patch: Record<string, unknown> = {};
        if (input.name !== undefined) patch.name = input.name;
        if (input.description !== undefined) patch.description = input.description;
        if (input.bedType !== undefined) patch.bed_type = input.bedType;
        if (input.priceEur !== undefined) patch.base_price_per_night = input.priceEur * 100;
        if (input.images !== undefined) patch.images = input.images;
        if (input.amenities !== undefined) patch.amenities = input.amenities;
        if (Object.keys(patch).length === 0) return err("Nothing to update");

        const { error } = await supabase.from("rooms").update(patch).eq("id", room.id);
        if (error) return err(error.message);
        await auditAgent("agent.room_update", "room", room.id, `updated room "${room.name}" (${Object.keys(patch).join(", ")})`);
        return ok(`Updated ${room.name}: ${Object.keys(patch).join(", ")}`);
      }
    );

    server.registerTool(
      "application_set_status",
      {
        title: "Move an application through screening",
        description:
          "Set an application's status: submitted | screening | waitlist | rejected. Approval is deliberately console-only (it creates the member account and entrance link).",
        inputSchema: {
          id: z.string().uuid(),
          status: z.enum(["submitted", "screening", "waitlist", "rejected"]),
          note: z.string().optional(),
        },
      },
      async ({ id, status, note }) => {
        const supabase = getSupabaseAdmin();
        const { data: app } = await supabase
          .from("applications")
          .select("id, first_name, last_name, status")
          .eq("id", id)
          .maybeSingle();
        if (!app) return err("Application not found");
        if (app.status === "approved") return err("Already approved — manage approved members in the console");

        const who = agentContext.getStore();
        const { error } = await supabase
          .from("applications")
          .update({ status, reviewed_by: who?.adminId || null, reviewed_at: new Date().toISOString() })
          .eq("id", id);
        if (error) return err(error.message);
        if (note) {
          await supabase.from("admin_notes").insert({
            author_id: who?.adminId || null,
            author_email: who?.adminEmail || "agent",
            entity_type: "application",
            entity_id: id,
            body: note,
          });
        }
        await auditAgent(
          "agent.application_status",
          "application",
          id,
          `${app.first_name} ${app.last_name}: ${app.status} → ${status}`
        );
        return ok(`${app.first_name} ${app.last_name} → ${status}`);
      }
    );

    server.registerTool(
      "lead_update_status",
      {
        title: "Update a lead's status",
        description: "Set a lead's CRM status by email: new | active | inactive | blacklisted. Optional note lands on the lead record.",
        inputSchema: {
          email: z.string().email(),
          status: z.enum(["new", "active", "inactive", "blacklisted"]),
          note: z.string().optional(),
        },
      },
      async ({ email, status, note }) => {
        const supabase = getSupabaseAdmin();
        const normalized = email.toLowerCase().trim();
        const { data: lead } = await supabase
          .from("leads")
          .select("id, first_name, last_name, status")
          .eq("email", normalized)
          .maybeSingle();
        if (!lead) return err(`No lead with email ${normalized}`);

        const { error } = await supabase.from("leads").update({ status }).eq("id", lead.id);
        if (error) return err(error.message);
        if (note) {
          const who = agentContext.getStore();
          await supabase.from("admin_notes").insert({
            author_id: who?.adminId || null,
            author_email: who?.adminEmail || "agent",
            entity_type: "lead",
            entity_id: lead.id,
            body: note,
          });
        }
        await auditAgent("agent.lead_status", "lead", lead.id, `${lead.first_name} ${lead.last_name} (${normalized}): ${lead.status} → ${status}`);
        return ok(`${normalized} → ${status}`);
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
