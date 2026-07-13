import { createMcpHandler } from "mcp-handler";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildKbTree, getKbNode, listKbNodes, searchKb, upsertKbNode } from "@core/kb";
import { writeAudit } from "@core/audit";
import { getSupabaseAdmin } from "@core/supabase";
import { DEFAULT_TIMEZONE, zonedToUtc } from "@core/scheduling";
import { config } from "@core/config";
import { mergeLabels, removeLabels } from "@core/labels";
import type { CrmEntityType, Json } from "@core/database.types";
import { agentContext, resolveAgent } from "@/lib/agent-auth";
import { doorPath } from "@/lib/format";

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

    server.registerTool(
      "referral_link_create",
      {
        title: "Create a referral door (hosted signup form)",
        description:
          "Mint a new door: member (application + screening call at /r/<code>), instant_member (account on the spot, no screening — investor decks, QR cards), or vendor/staff (hiring at /v/<code>). Labels stamp everyone who enters (visible across the CRM). Optional custom code, usage cap, expiry. Returns the shareable URL.",
        inputSchema: {
          kind: z.enum(["member", "instant_member", "vendor", "staff"]),
          label: z.string().min(2).describe("Internal name, e.g. 'Investor deck' or 'Don's July dinner guests'"),
          labels: z.array(z.string()).optional().describe("CRM labels applied to everyone who enters, e.g. ['investor']"),
          code: z.string().optional().describe("Custom URL code; defaults to a slug of the label"),
          note: z.string().optional(),
          maxUses: z.number().int().positive().optional(),
          expiresAt: z.string().optional().describe("ISO date/datetime when the door closes"),
        },
      },
      async (input) => {
        const supabase = getSupabaseAdmin();
        const base = slugify(input.code || input.label) || "door";
        let code = base;
        const { data: taken } = await supabase
          .from("referral_links")
          .select("code")
          .like("code", `${base}%`);
        const existing = new Set(((taken as { code: string }[]) || []).map((r) => r.code));
        for (let i = 2; existing.has(code); i++) code = `${base}-${i}`;

        const expiresAt = input.expiresAt ? parseWhen(input.expiresAt) || null : null;
        const labels = mergeLabels(input.labels || []);
        const who = agentContext.getStore();
        const { data: link, error } = await supabase
          .from("referral_links")
          .insert({
            code,
            kind: input.kind,
            label: input.label,
            note: input.note || null,
            labels,
            max_uses: input.maxUses ?? null,
            expires_at: expiresAt,
            active: true,
            created_by: who?.adminId || null,
          })
          .select("id, code")
          .single();
        if (error || !link) return err(error?.message || "Could not create the link");

        const url = `${config.baseUrl}${doorPath(input.kind, link.code)}`;
        await auditAgent("agent.referral_link_create", "referral_link", link.id, `created ${input.kind} door "${input.label}" → ${url}${labels.length ? ` · labels: ${labels.join(", ")}` : ""}`);
        return ok(`Created "${input.label}" — share ${url}${labels.length ? ` · labels ${labels.join(", ")}` : ""}${expiresAt ? ` (closes ${expiresAt.slice(0, 10)})` : ""}${input.maxUses ? ` · max ${input.maxUses} uses` : ""}`);
      }
    );

    server.registerTool(
      "referral_link_set",
      {
        title: "Open, close, or edit a referral link",
        description:
          "Update a referral door by code: activate/deactivate, rename, change note, usage cap, or expiry.",
        inputSchema: {
          code: z.string(),
          active: z.boolean().optional(),
          label: z.string().optional(),
          note: z.string().optional(),
          labels: z.array(z.string()).optional().describe("Replace the door's CRM labels"),
          maxUses: z.number().int().positive().nullable().optional(),
          expiresAt: z.string().nullable().optional().describe("ISO date, or null to remove expiry"),
        },
      },
      async (input) => {
        const supabase = getSupabaseAdmin();
        const code = input.code.toLowerCase().trim();
        const { data: link } = await supabase
          .from("referral_links")
          .select("id, code, kind, label, active")
          .eq("code", code)
          .maybeSingle();
        if (!link) return err(`No referral link with code "${code}"`);

        const patch: Record<string, unknown> = {};
        if (input.active !== undefined) patch.active = input.active;
        if (input.label !== undefined) patch.label = input.label;
        if (input.note !== undefined) patch.note = input.note;
        if (input.labels !== undefined) patch.labels = mergeLabels(input.labels);
        if (input.maxUses !== undefined) patch.max_uses = input.maxUses;
        if (input.expiresAt !== undefined)
          patch.expires_at = input.expiresAt ? parseWhen(input.expiresAt) : null;
        if (Object.keys(patch).length === 0) return err("Nothing to update");

        const { error } = await supabase.from("referral_links").update(patch).eq("id", link.id);
        if (error) return err(error.message);
        await auditAgent("agent.referral_link_set", "referral_link", link.id, `updated door "${link.label}" (${Object.keys(patch).join(", ")})`);
        return ok(`Updated ${code}: ${Object.keys(patch).join(", ")}`);
      }
    );

    server.registerTool(
      "referral_link_list",
      {
        title: "List referral links",
        description: "All referral doors with URLs, kinds, labels, status, and use counts.",
        inputSchema: {
          kind: z.enum(["member", "instant_member", "vendor", "staff"]).optional(),
        },
      },
      async (input) => {
        const supabase = getSupabaseAdmin();
        let query = supabase
          .from("referral_links")
          .select("code, kind, label, labels, active, use_count, max_uses, expires_at")
          .order("created_at", { ascending: false })
          .limit(50);
        if (input.kind) query = query.eq("kind", input.kind);
        const { data } = await query;
        const rows = (data as {
          code: string; kind: string; label: string; labels: string[] | null; active: boolean;
          use_count: number; max_uses: number | null; expires_at: string | null;
        }[]) || [];
        if (!rows.length) return ok("No referral links yet — create one with referral_link_create.");
        const lines = rows.map((r) => {
          const url = `${config.baseUrl}${doorPath(r.kind, r.code)}`;
          return `${r.active ? "🟢" : "⚫"} ${r.label} [${r.kind.replace("_", " ")}] — ${url} · ${r.use_count}${r.max_uses ? `/${r.max_uses}` : ""} uses${(r.labels || []).length ? ` · labels: ${(r.labels || []).join(", ")}` : ""}${r.expires_at ? ` · closes ${r.expires_at.slice(0, 10)}` : ""}`;
        });
        return ok(lines.join("\n"));
      }
    );

    server.registerTool(
      "user_labels_update",
      {
        title: "Add or remove CRM labels on a person",
        description:
          "Edit the labels that stick to a person across the CRM (e.g. 'investor', 'past guest'). Finds the person by email. add/remove merge with what's there; set replaces everything.",
        inputSchema: {
          email: z.string().describe("The person's account email"),
          add: z.array(z.string()).optional(),
          remove: z.array(z.string()).optional(),
          set: z.array(z.string()).optional().describe("Replace all labels (overrides add/remove)"),
        },
      },
      async (input) => {
        const supabase = getSupabaseAdmin();
        const email = input.email.toLowerCase().trim();
        const { data: user } = await supabase
          .from("users")
          .select("id, email, lead_id, labels")
          .eq("email", email)
          .maybeSingle();
        if (!user) return err(`No account with email ${email}`);

        let labels: string[];
        if (input.set !== undefined) {
          labels = mergeLabels(input.set);
        } else {
          labels = mergeLabels(user.labels, input.add || []);
          if (input.remove?.length) labels = removeLabels(labels, input.remove);
        }

        const { error } = await supabase.from("users").update({ labels }).eq("id", user.id);
        if (error) return err(error.message);
        if (user.lead_id) {
          await supabase.from("leads").update({ labels }).eq("id", user.lead_id);
        }
        await auditAgent(
          "agent.user_labels_update",
          "user",
          user.id,
          labels.length ? `labels for ${email}: ${labels.join(", ")}` : `labels cleared for ${email}`
        );
        return ok(`${email} → ${labels.length ? labels.join(", ") : "(no labels)"}`);
      }
    );

    server.registerTool(
      "closure_create",
      {
        title: "Close a gate or room for a period",
        description:
          "Block availability: whole gate (omit roomSlug) or one room, from startsOn to endsOn inclusive. Omit endsOn to close indefinitely. Members immediately stop seeing those dates as bookable.",
        inputSchema: {
          gateSlug: z.string(),
          roomSlug: z.string().optional(),
          startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          reason: z.string().optional(),
        },
      },
      async (input) => {
        const supabase = getSupabaseAdmin();
        const { data: gate } = await supabase
          .from("villas")
          .select("id, name")
          .eq("slug", input.gateSlug)
          .maybeSingle();
        if (!gate) return err(`No gate "${input.gateSlug}"`);
        if (input.endsOn && input.endsOn < input.startsOn) return err("endsOn is before startsOn");

        let roomId: string | null = null;
        let roomName = "";
        if (input.roomSlug) {
          const { data: room } = await supabase
            .from("rooms")
            .select("id, name")
            .eq("villa_id", gate.id)
            .eq("slug", input.roomSlug)
            .maybeSingle();
          if (!room) return err(`No room "${input.roomSlug}" at that gate`);
          roomId = room.id;
          roomName = room.name;
        }

        const who = agentContext.getStore();
        const { data: closure, error } = await supabase
          .from("closure_periods")
          .insert({
            villa_id: gate.id,
            room_id: roomId,
            starts_on: input.startsOn,
            ends_on: input.endsOn || null,
            reason: input.reason || null,
            created_by: who?.adminId || null,
          })
          .select("id")
          .single();
        if (error || !closure) return err(error?.message || "Could not create the closure");

        const scope = roomId ? `room ${roomName}` : `all of ${gate.name}`;
        const until = input.endsOn || "further notice";
        await auditAgent("agent.closure_create", roomId ? "room" : "villa", roomId || gate.id, `closed ${scope}: ${input.startsOn} → ${until}${input.reason ? ` (${input.reason})` : ""}`, { closure_id: closure.id });
        return ok(`Closed ${scope} from ${input.startsOn} until ${until}. Closure id: ${closure.id}`);
      }
    );

    server.registerTool(
      "closure_list",
      {
        title: "List closures",
        description: "Current and upcoming closure periods (gate-wide and per-room), with ids for closure_delete.",
        inputSchema: {
          gateSlug: z.string().optional(),
        },
      },
      async (input) => {
        const supabase = getSupabaseAdmin();
        const today = new Date().toISOString().slice(0, 10);
        let query = supabase
          .from("closure_periods")
          .select("id, villa_id, room_id, starts_on, ends_on, reason")
          .or(`ends_on.is.null,ends_on.gte.${today}`)
          .order("starts_on", { ascending: true })
          .limit(60);
        if (input.gateSlug) {
          const { data: gate } = await supabase
            .from("villas")
            .select("id")
            .eq("slug", input.gateSlug)
            .maybeSingle();
          if (!gate) return err(`No gate "${input.gateSlug}"`);
          query = query.eq("villa_id", gate.id);
        }
        const { data } = await query;
        const rows = (data as {
          id: string; villa_id: string | null; room_id: string | null;
          starts_on: string; ends_on: string | null; reason: string | null;
        }[]) || [];
        if (!rows.length) return ok("No active or upcoming closures.");

        const roomIds = rows.map((r) => r.room_id).filter((x): x is string => !!x);
        const villaIds = rows.map((r) => r.villa_id).filter((x): x is string => !!x);
        const [{ data: rooms }, { data: villas }] = await Promise.all([
          roomIds.length
            ? supabase.from("rooms").select("id, name").in("id", roomIds)
            : Promise.resolve({ data: [] as { id: string; name: string }[] }),
          villaIds.length
            ? supabase.from("villas").select("id, name").in("id", villaIds)
            : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        ]);
        const roomName = new Map(((rooms as { id: string; name: string }[]) || []).map((r) => [r.id, r.name]));
        const villaName = new Map(((villas as { id: string; name: string }[]) || []).map((v) => [v.id, v.name]));

        const lines = rows.map((r) => {
          const scope = r.room_id
            ? `${roomName.get(r.room_id) || "room"} @ ${villaName.get(r.villa_id || "") || "gate"}`
            : `ALL of ${villaName.get(r.villa_id || "") || "gate"}`;
          return `${scope}: ${r.starts_on} → ${r.ends_on || "∞"}${r.reason ? ` (${r.reason})` : ""} · id ${r.id}`;
        });
        return ok(lines.join("\n"));
      }
    );

    server.registerTool(
      "closure_delete",
      {
        title: "Reopen a closed period",
        description: "Delete a closure by id (get ids from closure_list). Availability opens back up immediately.",
        inputSchema: {
          id: z.string().uuid(),
        },
      },
      async ({ id }) => {
        const supabase = getSupabaseAdmin();
        const { data: closure } = await supabase
          .from("closure_periods")
          .select("id, villa_id, room_id, starts_on, ends_on")
          .eq("id", id)
          .maybeSingle();
        if (!closure) return err("Closure not found");

        const { error } = await supabase.from("closure_periods").delete().eq("id", id);
        if (error) return err(error.message);
        await auditAgent(
          "agent.closure_delete",
          closure.room_id ? "room" : "villa",
          closure.room_id || closure.villa_id,
          `reopened ${closure.starts_on} → ${closure.ends_on || "∞"} (closure ${id})`
        );
        return ok(`Reopened — closure ${id} deleted.`);
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
