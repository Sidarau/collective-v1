export type ApprovableStayStatus = "requested" | "waitlisted";

export interface StayApprovalActor {
  id: string;
  email: string;
  label?: string | null;
  via: "console" | "agent";
}

export interface AtomicStayApproval {
  booking_id: string;
  changed: boolean;
  from_status: string;
  status: "approved";
  check_in: string;
  check_out: string;
  user_id: string | null;
}

export interface StayApprovalInput {
  id: string;
  expectedStatus: ApprovableStayStatus;
  note?: string;
  notify?: boolean;
  actor: StayApprovalActor;
}

export type StayNotificationStatus =
  | "skipped"
  | "logged"
  | "sent"
  | "suppressed"
  | "failed"
  | "recipient_missing";

export interface StayApprovalResult extends AtomicStayApproval {
  notification: StayNotificationStatus;
}

export interface StayApprovalAudit {
  action: "booking.approve" | "booking.approve_unchanged" | "booking.approve_blocked";
  bookingId: string;
  actor: StayApprovalActor;
  summary: string;
  meta: Record<string, string | boolean | null | undefined>;
}

export interface StayApprovalDependencies {
  approveAtomic(input: {
    id: string;
    expectedStatus: ApprovableStayStatus;
    note: string | null;
  }): Promise<AtomicStayApproval>;
  resolveRecipient(userId: string): Promise<string | null>;
  notifyApproved(input: {
    bookingId: string;
    email: string;
    checkIn: string;
    checkOut: string;
    actorId: string;
  }): Promise<Exclude<StayNotificationStatus, "skipped" | "recipient_missing">>;
  audit(event: StayApprovalAudit): Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Stay approval failed";
}

async function safeAudit(
  dependencies: StayApprovalDependencies,
  event: StayApprovalAudit
): Promise<void> {
  try {
    await dependencies.audit(event);
  } catch {
    // Approval is the source-of-truth mutation. Audit failures are already
    // monitored independently and must not turn a completed decision into an
    // apparent failure that callers might retry.
  }
}

/**
 * Shared console/MCP approval orchestration.
 *
 * Atomic eligibility and availability checks live in Postgres. This layer
 * owns the optional outbox notification and the attributable audit receipt.
 */
export async function approveStayRequest(
  input: StayApprovalInput,
  dependencies: StayApprovalDependencies
): Promise<StayApprovalResult> {
  let approval: AtomicStayApproval;
  try {
    approval = await dependencies.approveAtomic({
      id: input.id,
      expectedStatus: input.expectedStatus,
      note: input.note?.trim() || null,
    });
  } catch (error) {
    const reason = errorMessage(error);
    await safeAudit(dependencies, {
      action: "booking.approve_blocked",
      bookingId: input.id,
      actor: input.actor,
      summary: "Stay approval blocked",
      meta: {
        expected_status: input.expectedStatus,
        reason: reason.slice(0, 240),
      },
    });
    throw error;
  }

  if (!approval.changed) {
    await safeAudit(dependencies, {
      action: "booking.approve_unchanged",
      bookingId: approval.booking_id,
      actor: input.actor,
      summary: `Window ${approval.check_in} → ${approval.check_out} was already approved`,
      meta: {
        from_status: approval.from_status,
        to_status: approval.status,
        notification_requested: Boolean(input.notify),
      },
    });
    return { ...approval, notification: "skipped" };
  }

  let notification: StayNotificationStatus = "skipped";
  if (input.notify) {
    if (!approval.user_id) {
      notification = "recipient_missing";
    } else {
      const email = await dependencies.resolveRecipient(approval.user_id);
      if (!email) {
        notification = "recipient_missing";
      } else {
        try {
          notification = await dependencies.notifyApproved({
            bookingId: approval.booking_id,
            email,
            checkIn: approval.check_in,
            checkOut: approval.check_out,
            actorId: input.actor.id,
          });
        } catch {
          notification = "failed";
        }
      }
    }
  }

  await safeAudit(dependencies, {
    action: "booking.approve",
    bookingId: approval.booking_id,
    actor: input.actor,
    summary: `Window ${approval.check_in} → ${approval.check_out} approved`,
    meta: {
      from_status: approval.from_status,
      to_status: approval.status,
      notification_requested: Boolean(input.notify),
      notification,
    },
  });

  return { ...approval, notification };
}

export interface StayRequestSearchSource {
  id: string;
  memberName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  roomName: string;
  gateName: string;
  // The source may carry private fields internally. They are deliberately
  // omitted by publicStayRequestView.
  email?: string;
  phone?: string | null;
  operatorNotes?: string | null;
}

export interface StayRequestSearchResult {
  id: string;
  memberName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  roomName: string;
  gateName: string;
}

export function publicStayRequestView(
  source: StayRequestSearchSource
): StayRequestSearchResult {
  return {
    id: source.id,
    memberName: source.memberName,
    checkIn: source.checkIn,
    checkOut: source.checkOut,
    status: source.status,
    roomName: source.roomName,
    gateName: source.gateName,
  };
}
