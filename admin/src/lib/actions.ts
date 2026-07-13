"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@core/supabase";
import { writeAudit } from "@core/audit";
import { sendTrackedEmail, sendMagicLinkEmail } from "@core/email";
import { mintMagicLink } from "@core/invites";
import { config } from "@core/config";
import { mergeLabels } from "@core/labels";
import { BLOCKING_STATUSES, fetchVillaClosures, isClosedFor, isRoomAvailable } from "@core/availability";
import type {
  ApplicationRow,
  BookingRow,
  CrmEntityType,
  ProfileRow,
  UserRole,
} from "@core/database.types";
import { getAdminUser } from "./auth";

const db = getSupabaseAdmin;

/** Defense in depth: the layout guards pages, every mutation re-checks. */
async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Not authorized");
  return admin;
}

function backTo(path: string, error?: string): never {
  redirect(error ? `${path}?error=${encodeURIComponent(error)}` : path);
}

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

// ---------------------------------------------------------------- Applications

async function loadApplication(id: string): Promise<ApplicationRow | null> {
  const { data } = await db().from("applications").select("*").eq("id", id).maybeSingle();
  return (data as ApplicationRow) || null;
}

/**
 * Approve: lead becomes member, profile is seeded from their application,
 * an onboarding entrance link is minted + logged (sent only in EMAIL_MODE=send),
 * referral credit is opened when the referrer is resolvable, audit written.
 */
export async function approveApplicationAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const path = `/applications/${id}`;
  const application = await loadApplication(id);
  if (!application) backTo("/applications", "Application not found");

  try {
    const supabase = db();
    const email = application.email.toLowerCase();

    // 1. Ensure the user exists and is a member.
    let userId = application.user_id;
    if (!userId) {
      const { data: existing } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
      userId = existing?.id || null;
    }
    if (userId) {
      await supabase.from("users").update({ role: "member" }).eq("id", userId);
    } else {
      const { data: created, error } = await supabase
        .from("users")
        .insert({ email, role: "member", lead_id: application.lead_id })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message || "user create failed");
      userId = created.id;
    }

    // 2. Seed the profile from their application (onboarding still to come).
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!existingProfile) {
      await supabase.from("profiles").insert({
        user_id: userId,
        first_name: application.first_name,
        last_name: application.last_name,
        headline: application.occupation,
        location: application.location,
        motivation: application.motivation,
        contribution: application.contribution,
        onboarding_completed: false,
      } as Partial<ProfileRow>);
    }

    // 3. Application state.
    await supabase
      .from("applications")
      .update({
        status: "approved",
        user_id: userId,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    // 4. Referral credit — best effort, only when the referrer resolves cleanly.
    if (application.lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("source")
        .eq("id", application.lead_id)
        .maybeSingle();
      const referrerName = lead?.source?.startsWith("member_referral:")
        ? lead.source.slice("member_referral:".length)
        : null;
      if (referrerName) {
        const [first, ...rest] = referrerName.split(" ");
        const { data: matches } = await supabase
          .from("profiles")
          .select("user_id")
          .ilike("first_name", first || "")
          .ilike("last_name", rest.join(" ") || "%");
        if (matches?.length === 1) {
          await supabase.from("referral_credits").insert({
            referrer_user_id: matches[0].user_id,
            referred_user_id: userId,
            referred_email: email,
            status: "pending",
            note: `Auto-opened on approval of ${application.first_name} ${application.last_name}`,
          });
        }
      }
    }

    // 5. Onboarding entrance link (logged in outbox; sent only when enabled).
    const link = await mintMagicLink(userId, email, config.baseUrl);
    await sendMagicLinkEmail({
      to: email,
      firstName: application.first_name,
      magicLink: link,
      intro: `The Circle has said yes. Step through to complete your profile and plan your first window at the Gate.`,
      cta: "Complete your entrance",
      template: "approved_onboarding",
      entityType: "application",
      entityId: id,
      actorId: admin.id,
    });

    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "application.approve",
      entityType: "application",
      entityId: id,
      summary: `Approved ${application.first_name} ${application.last_name} — member access + onboarding link minted`,
    });
  } catch (err) {
    backTo(path, err instanceof Error ? err.message : "Approve failed");
  }
  revalidatePath(path);
  revalidatePath("/applications");
  backTo(path);
}

export async function setApplicationStatusAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const status = str(formData, "status") as ApplicationRow["status"];
  const notify = str(formData, "notify") === "on";
  const path = `/applications/${id}`;

  if (!["screening", "waitlist", "rejected", "submitted"].includes(status)) {
    backTo(path, "Invalid status");
  }
  const application = await loadApplication(id);
  if (!application) backTo("/applications", "Application not found");

  try {
    await db()
      .from("applications")
      .update({
        status,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (notify && (status === "rejected" || status === "waitlist")) {
      const copy =
        status === "rejected"
          ? {
              subject: `Your introduction to ${config.brandName}`,
              heading: `Dear ${application.first_name},`,
              body: "Thank you for the introduction. The Circle stays deliberately small, and this season we couldn't extend an invitation. We keep every introduction — seasons change.",
            }
          : {
              subject: `Your introduction to ${config.brandName}`,
              heading: `Dear ${application.first_name},`,
              body: "Thank you for your introduction. The season is currently full — you're on the inside track, and we'll reach out the moment a window opens.",
            };
      await sendTrackedEmail({
        to: application.email,
        ...copy,
        template: `application_${status}`,
        entityType: "application",
        entityId: id,
        actorId: admin.id,
      });
    }

    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: `application.${status}`,
      entityType: "application",
      entityId: id,
      summary: `${application.first_name} ${application.last_name} → ${status}${notify ? " (notified)" : ""}`,
    });
  } catch (err) {
    backTo(path, err instanceof Error ? err.message : "Update failed");
  }
  revalidatePath(path);
  revalidatePath("/applications");
  backTo(path);
}

export async function resendOnboardingLinkAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const path = `/applications/${id}`;
  const application = await loadApplication(id);
  if (!application?.user_id) backTo(path, "No member account yet — approve first");

  try {
    const link = await mintMagicLink(application.user_id, application.email, config.baseUrl);
    await sendMagicLinkEmail({
      to: application.email,
      firstName: application.first_name,
      magicLink: link,
      template: "approved_onboarding",
      entityType: "application",
      entityId: id,
      actorId: admin.id,
    });
    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "application.resend_link",
      entityType: "application",
      entityId: id,
      summary: `Fresh onboarding link minted for ${application.email}`,
    });
  } catch (err) {
    backTo(path, err instanceof Error ? err.message : "Resend failed");
  }
  revalidatePath(path);
  backTo(path);
}

// ---------------------------------------------------------------- Stay requests

async function loadBooking(id: string): Promise<BookingRow | null> {
  const { data } = await db().from("bookings").select("*").eq("id", id).maybeSingle();
  return (data as BookingRow) || null;
}

const REQUEST_TRANSITIONS: Record<string, { status: BookingRow["status"]; action: string; label: string }> = {
  approve: { status: "approved", action: "booking.approve", label: "approved" },
  reject: { status: "cancelled", action: "booking.reject", label: "rejected" },
  deposit: { status: "deposit_paid", action: "booking.deposit_received", label: "deposit received" },
  paid: { status: "paid", action: "booking.paid", label: "paid in full" },
  confirm: { status: "confirmed", action: "booking.confirm", label: "confirmed" },
  cancel: { status: "cancelled", action: "booking.cancel", label: "cancelled" },
  complete: { status: "completed", action: "booking.complete", label: "completed" },
};

export async function requestTransitionAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const op = str(formData, "op");
  const note = str(formData, "note");
  const notify = str(formData, "notify") === "on";
  const path = `/requests/${id}`;

  const transition = REQUEST_TRANSITIONS[op];
  if (!transition) backTo(path, "Unknown action");

  const booking = await loadBooking(id);
  if (!booking) backTo("/requests", "Request not found");

  try {
    const supabase = db();

    // Approving claims the room — re-check the window against everyone else.
    if (op === "approve") {
      const [{ data: others }, { data: blocks }, closures] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, room_id, check_in, check_out, status")
          .eq("room_id", booking.room_id)
          .neq("id", booking.id)
          .in("status", BLOCKING_STATUSES)
          .lt("check_in", booking.check_out)
          .gt("check_out", booking.check_in),
        supabase
          .from("availability_blocks")
          .select("room_id, date, status")
          .eq("room_id", booking.room_id)
          .neq("status", "available")
          .gte("date", booking.check_in)
          .lt("date", booking.check_out),
        fetchVillaClosures(supabase, booking.villa_id, booking.check_in, booking.check_out),
      ]);
      if (isClosedFor(booking.room_id, booking.check_in, booking.check_out, closures)) {
        backTo(path, "The house is closed for part of this window — approve is blocked");
      }
      if (!isRoomAvailable(booking.room_id, booking.check_in, booking.check_out, others || [], blocks || [], closures)) {
        backTo(path, "Conflict: that room is already committed for part of this window");
      }
    }

    await supabase
      .from("bookings")
      .update({
        status: transition.status,
        operator_notes: note ? `${booking.operator_notes ? booking.operator_notes + "\n" : ""}${note}` : booking.operator_notes,
      })
      .eq("id", id);

    // Manual money trail for deposit/paid.
    if (op === "deposit" || op === "paid") {
      const amount = parseInt(str(formData, "amount") || "0", 10);
      await supabase.from("payment_records").insert({
        booking_id: id,
        kind: op === "deposit" ? "deposit" : "balance",
        amount: Number.isFinite(amount) && amount > 0 ? amount * 100 : 0,
        currency: booking.currency,
        method: str(formData, "method") || null,
        reference: str(formData, "reference") || null,
        note: note || null,
        recorded_by: admin.id,
      });
    }

    // Member-facing status emails (outbox-gated).
    if (notify && booking.user_id) {
      const { data: person } = await supabase
        .from("users")
        .select("email")
        .eq("id", booking.user_id)
        .maybeSingle();
      if (person?.email) {
        const windowStr = `${booking.check_in} → ${booking.check_out}`;
        const copyByOp: Record<string, { subject: string; body: string }> = {
          approve: {
            subject: "Your window is approved",
            body: `Your window ${windowStr} has been approved by the host. You'll receive arrival details as the dates approach.`,
          },
          confirm: {
            subject: "Your window is confirmed",
            body: `Your window ${windowStr} is confirmed. The house is expecting you.`,
          },
          reject: {
            subject: "About your requested window",
            body: `The house couldn't hold ${windowStr} this time. ${note || "Reply and we'll find you another window."}`,
          },
          cancel: {
            subject: "Your window was released",
            body: `Your window ${windowStr} has been released. ${note || ""}`,
          },
        };
        const copy = copyByOp[op];
        if (copy) {
          await sendTrackedEmail({
            to: person.email,
            heading: "From the Gate",
            ...copy,
            template: `stay_${op}`,
            entityType: "booking",
            entityId: id,
            actorId: admin.id,
          });
        }
      }
    }

    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: transition.action,
      entityType: "booking",
      entityId: id,
      summary: `Window ${booking.check_in} → ${booking.check_out} ${transition.label}${note ? ` — ${note}` : ""}`,
      meta: { from_status: booking.status, to_status: transition.status },
    });
  } catch (err) {
    backTo(path, err instanceof Error ? err.message : "Action failed");
  }
  revalidatePath(path);
  revalidatePath("/requests");
  backTo(path);
}

export async function suggestAlternativeAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const message = str(formData, "message");
  const path = `/requests/${id}`;
  const booking = await loadBooking(id);
  if (!booking) backTo("/requests", "Request not found");
  if (!message) backTo(path, "Write the alternative you want to suggest");

  try {
    await db().from("admin_notes").insert({
      author_id: admin.id,
      author_email: admin.email,
      entity_type: "booking",
      entity_id: id,
      body: `Suggested alternative: ${message}`,
    });

    if (booking.user_id) {
      const { data: person } = await db()
        .from("users")
        .select("email")
        .eq("id", booking.user_id)
        .maybeSingle();
      if (person?.email) {
        await sendTrackedEmail({
          to: person.email,
          subject: "An alternative window at the Gate",
          heading: "From the Gate",
          body: `About your request for ${booking.check_in} → ${booking.check_out}: ${message}`,
          template: "stay_alternative",
          entityType: "booking",
          entityId: id,
          actorId: admin.id,
        });
      }
    }

    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "booking.suggest_alternative",
      entityType: "booking",
      entityId: id,
      summary: `Alternative suggested — ${message.slice(0, 120)}`,
    });
  } catch (err) {
    backTo(path, err instanceof Error ? err.message : "Failed to suggest alternative");
  }
  revalidatePath(path);
  backTo(path);
}

// ---------------------------------------------------------------- Shared CRM

export async function addNoteAction(formData: FormData) {
  const admin = await requireAdmin();
  const entityType = str(formData, "entityType") as CrmEntityType;
  const entityId = str(formData, "entityId");
  const body = str(formData, "body");
  const path = str(formData, "path") || "/";
  if (!body) backTo(path, "Note is empty");

  await db().from("admin_notes").insert({
    author_id: admin.id,
    author_email: admin.email,
    entity_type: entityType,
    entity_id: entityId,
    body,
  });
  revalidatePath(path);
  backTo(path);
}

export async function addFollowUpAction(formData: FormData) {
  const admin = await requireAdmin();
  const path = str(formData, "path") || "/";
  const title = str(formData, "title");
  if (!title) backTo(path, "Follow-up needs a title");

  await db().from("follow_ups").insert({
    owner_id: admin.id,
    owner_email: admin.email,
    entity_type: (str(formData, "entityType") || null) as CrmEntityType | null,
    entity_id: str(formData, "entityId") || null,
    title,
    due_at: str(formData, "dueAt") || null,
  });
  revalidatePath(path);
  revalidatePath("/");
  backTo(path);
}

export async function setFollowUpStatusAction(formData: FormData) {
  await requireAdmin();
  const path = str(formData, "path") || "/";
  const raw = str(formData, "status");
  const status: "open" | "done" | "cancelled" =
    raw === "open" || raw === "cancelled" ? raw : "done";
  await db().from("follow_ups").update({ status }).eq("id", str(formData, "id"));
  revalidatePath(path);
  revalidatePath("/");
  backTo(path);
}

// ---------------------------------------------------------------- People

export async function setPersonRoleAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  const role = str(formData, "role") as UserRole;
  const path = `/people/${userId}`;
  if (!["lead", "member", "admin", "operator"].includes(role)) backTo(path, "Invalid role");

  const { data: person } = await db().from("users").select("email, role").eq("id", userId).maybeSingle();
  if (!person) backTo("/people", "Person not found");

  await db().from("users").update({ role }).eq("id", userId);
  await writeAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "user.role_change",
    entityType: "user",
    entityId: userId,
    summary: `${person.email}: ${person.role} → ${role}`,
  });
  revalidatePath(path);
  revalidatePath("/people");
  backTo(path);
}

export async function reinvitePersonAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  const path = `/people/${userId}`;

  const { data: person } = await db().from("users").select("id, email").eq("id", userId).maybeSingle();
  if (!person) backTo("/people", "Person not found");

  try {
    const { data: profile } = await db()
      .from("profiles")
      .select("first_name")
      .eq("user_id", userId)
      .maybeSingle();
    const link = await mintMagicLink(person.id, person.email, config.baseUrl);
    await sendMagicLinkEmail({
      to: person.email,
      firstName: profile?.first_name || person.email.split("@")[0],
      magicLink: link,
      template: "reinvite",
      entityType: "user",
      entityId: userId,
      actorId: admin.id,
    });
    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "user.reinvite",
      entityType: "user",
      entityId: userId,
      summary: `Fresh entrance link minted for ${person.email}`,
    });
  } catch (err) {
    backTo(path, err instanceof Error ? err.message : "Re-invite failed");
  }
  revalidatePath(path);
  backTo(path);
}

export async function toggleSuppressionAction(formData: FormData) {
  const admin = await requireAdmin();
  const email = str(formData, "email").toLowerCase();
  const path = str(formData, "path") || "/people";
  if (!email) backTo(path, "No email");

  const { data: existing } = await db()
    .from("email_suppressions")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    await db().from("email_suppressions").delete().eq("id", existing.id);
    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "email.unsuppress",
      entityType: "email",
      summary: `Unsuppressed ${email}`,
    });
  } else {
    await db().from("email_suppressions").insert({
      email,
      reason: "manual",
      note: str(formData, "note") || "Suppressed from console",
      created_by: admin.id,
    });
    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "email.suppress",
      entityType: "email",
      summary: `Suppressed ${email}`,
    });
  }
  revalidatePath(path);
  backTo(path);
}

/**
 * Mint an entrance link for an existing person and hand back a WhatsApp
 * share URL (?walink=…, shown once — the page strips it from history).
 */
export async function mintWhatsAppEntranceAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  const path = `/people/${userId}`;

  const { data: person } = await db()
    .from("users")
    .select("id, email, phone")
    .eq("id", userId)
    .maybeSingle();
  if (!person) backTo("/people", "Person not found");
  if (!person.phone) {
    backTo(path, "No phone on file — link one via a WhatsApp invite or the member's profile first");
  }

  try {
    const link = await mintMagicLink(person.id, person.email, config.baseUrl);
    // Log the mint in the outbox (not sent — WhatsApp is the delivery channel).
    await sendMagicLinkEmail({
      to: person.email,
      firstName: person.email.split("@")[0],
      magicLink: link,
      template: "whatsapp_entrance",
      entityType: "user",
      entityId: userId,
      actorId: admin.id,
    });
    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "user.whatsapp_entrance",
      entityType: "user",
      entityId: userId,
      summary: `Entrance link minted for WhatsApp delivery to ${person.email}`,
    });
    const wa = `https://wa.me/${person.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
      `Your private entrance to the Collective — works once: ${link}`
    )}`;
    revalidatePath(path);
    redirect(`${path}?walink=${encodeURIComponent(wa)}`);
  } catch (err) {
    // redirect() throws NEXT_REDIRECT — let it through.
    if (err && typeof err === "object" && "digest" in err) throw err;
    backTo(path, err instanceof Error ? err.message : "Could not mint the link");
  }
}

// ---------------------------------------------------------------- CRM labels

/** Replace a person's labels (users row + mirrored onto the linked lead). */
export async function updatePersonLabelsAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  const path = `/people/${userId}`;
  let labels: string[] = [];
  try {
    labels = mergeLabels(JSON.parse(str(formData, "labels") || "[]"));
  } catch {
    backTo(path, "Could not read the labels");
  }

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from("users")
    .select("id, email, lead_id, labels")
    .eq("id", userId)
    .maybeSingle();
  if (!user) backTo("/people", "Person not found");

  const { error } = await supabase.from("users").update({ labels }).eq("id", userId);
  if (error) backTo(path, error.message);
  if (user.lead_id) {
    await supabase.from("leads").update({ labels }).eq("id", user.lead_id);
  }

  await writeAudit({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "person.labels_updated",
    entityType: "user",
    entityId: userId,
    summary: labels.length ? `Labels set: ${labels.join(", ")}` : "Labels cleared",
    meta: { previous: user.labels || [], labels },
  });

  revalidatePath(path);
  revalidatePath("/people");
  backTo(path);
}
