export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Insert/Update are Partial<Row>: the service-role clients in this codebase
// always run behind server routes that validate input, so we trade exact
// column-level Insert typing for a schema definition that cannot drift
// three-ways per table. Supabase's type helpers require Relationships even
// when we do not model joins exhaustively by hand.
type Tbl<R> = {
  Row: R & Record<string, unknown>;
  Insert: Partial<R> & Record<string, unknown>;
  Update: Partial<R> & Record<string, unknown>;
  Relationships: [];
};

export type UserRole = "lead" | "member" | "admin" | "operator";
export type GateStatus = "published" | "coming_soon" | "archived";
export type BookingStatus =
  | "inquiry"
  | "requested"
  | "approved"
  | "deposit_paid"
  | "paid"
  | "confirmed"
  | "cancelled"
  | "completed";
export type ApplicationStatus =
  | "submitted"
  | "screening"
  | "approved"
  | "rejected"
  | "waitlist";
export type EventStatus = "draft" | "published" | "cancelled";
export type EventType = "dinner" | "experience" | "session" | "gathering" | "wellness";
export type RsvpStatus = "going" | "interested" | "declined";
export type StaffApplicationStatus =
  | "submitted"
  | "review"
  | "shortlisted"
  | "rejected"
  | "hired";

export interface VillaRow {
  id: string;
  name: string;
  slug: string;
  location: string;
  description: string | null;
  max_guests: number;
  images: string[];
  amenities: string[];
  status: GateStatus;
  tagline: string | null;
  story: string | null;
  hero_image: string | null;
  region: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RoomRow {
  id: string;
  villa_id: string;
  name: string;
  slug: string;
  description: string | null;
  room_type: "single" | "double" | "suite" | "master";
  max_guests: number;
  bed_type: string | null;
  images: string[];
  amenities: string[];
  base_price_per_night: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface SeasonalPricingRow {
  id: string;
  room_id: string;
  name: string;
  start_date: string;
  end_date: string;
  price_per_night: number;
  currency: string;
  min_nights: number;
  created_at: string;
}

export interface LeadRow {
  id: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  first_name: string;
  last_name: string;
  hubspot_contact_id: string | null;
  hubspot_deal_id: string | null;
  dietary_restrictions: string | null;
  notes: string | null;
  source: string;
  status: "new" | "active" | "inactive" | "blacklisted";
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: string;
  email: string;
  role: UserRole;
  lead_id: string | null;
  password_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface MagicTokenRow {
  id: string;
  user_id: string;
  token: string;
  used: boolean;
  expires_at: string;
  created_at: string;
}

export interface BookingRow {
  id: string;
  lead_id: string;
  user_id: string | null;
  room_id: string;
  villa_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  guest_names: string[];
  companion_name: string | null;
  event_id: string | null;
  status: BookingStatus;
  total_price: number;
  currency: string;
  special_requests: string | null;
  operator_notes: string | null;
  hubspot_deal_id: string | null;
  stripe_payment_intent_id: string | null;
  invoice_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvailabilityBlockRow {
  id: string;
  room_id: string;
  date: string;
  status: "available" | "booked" | "blocked" | "maintenance";
  booking_id: string | null;
  price_override: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  headline: string | null;
  location: string | null;
  bio: string | null;
  motivation: string | null;
  contribution: string | null;
  links: Json;
  allergies: string | null;
  dietary: string | null;
  phone: string | null;
  whatsapp: string | null;
  onboarding_completed: boolean;
  visibility: "members" | "hidden";
  created_at: string;
  updated_at: string;
}

export interface ApplicationRow {
  id: string;
  user_id: string | null;
  lead_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  location: string | null;
  occupation: string | null;
  motivation: string | null;
  contribution: string | null;
  referred_by: string | null;
  instagram: string | null;
  linkedin: string | null;
  links: Json;
  preferred_window: string | null;
  status: ApplicationStatus;
  admin_notes: string | null;
  hubspot_contact_id: string | null;
  hubspot_deal_id: string | null;
  hubspot_synced: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: string;
  villa_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  event_type: EventType;
  start_at: string;
  end_at: string | null;
  capacity: number | null;
  image: string | null;
  location_note: string | null;
  status: EventStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRsvpRow {
  id: string;
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  guests: number;
  created_at: string;
  updated_at: string;
}

export interface StaffApplicationRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role_applied: string;
  experience: string | null;
  links: Json;
  message: string | null;
  status: StaffApplicationStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntroRequestRow {
  id: string;
  from_user: string;
  to_user: string;
  note: string | null;
  status: "requested" | "accepted" | "declined" | "completed";
  created_at: string;
  updated_at: string;
}

// ---------- Native CRM (admin console) ----------

/** Which record a note/audit/email/follow-up is attached to. */
export type CrmEntityType =
  | "application"
  | "booking"
  | "user"
  | "lead"
  | "villa"
  | "room"
  | "event"
  | "intro_request"
  | "staff_application"
  | "email";

export type EmailMessageStatus =
  | "logged"
  | "queued"
  | "sent"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed"
  | "suppressed";

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: CrmEntityType;
  entity_id: string | null;
  summary: string | null;
  meta: Json;
  created_at: string;
}

export interface AdminNoteRow {
  id: string;
  author_id: string | null;
  author_email: string | null;
  entity_type: CrmEntityType;
  entity_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface FollowUpRow {
  id: string;
  owner_id: string | null;
  owner_email: string | null;
  entity_type: CrmEntityType | null;
  entity_id: string | null;
  title: string;
  due_at: string | null;
  status: "open" | "done" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface EmailMessageRow {
  id: string;
  to_email: string;
  template: string | null;
  subject: string;
  entity_type: CrmEntityType | null;
  entity_id: string | null;
  resend_id: string | null;
  status: EmailMessageStatus;
  error: string | null;
  meta: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailEventRow {
  id: string;
  email_message_id: string | null;
  resend_id: string | null;
  to_email: string | null;
  event_type: string;
  payload: Json;
  created_at: string;
}

export interface EmailSuppressionRow {
  id: string;
  email: string;
  reason: "unsubscribe" | "bounce" | "complaint" | "manual";
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ReferralCreditRow {
  id: string;
  referrer_user_id: string;
  referred_user_id: string | null;
  referred_email: string | null;
  status: "pending" | "eligible" | "redeemed" | "void";
  reward: string;
  redeemed_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentRecordRow {
  id: string;
  booking_id: string;
  kind: "deposit" | "balance" | "refund" | "other";
  amount: number;
  currency: string;
  method: string | null;
  reference: string | null;
  note: string | null;
  recorded_by: string | null;
  received_at: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      villas: Tbl<VillaRow>;
      rooms: Tbl<RoomRow>;
      seasonal_pricing: Tbl<SeasonalPricingRow>;
      leads: Tbl<LeadRow>;
      users: Tbl<UserRow>;
      magic_tokens: Tbl<MagicTokenRow>;
      bookings: Tbl<BookingRow>;
      availability_blocks: Tbl<AvailabilityBlockRow>;
      profiles: Tbl<ProfileRow>;
      applications: Tbl<ApplicationRow>;
      events: Tbl<EventRow>;
      event_rsvps: Tbl<EventRsvpRow>;
      staff_applications: Tbl<StaffApplicationRow>;
      intro_requests: Tbl<IntroRequestRow>;
      audit_logs: Tbl<AuditLogRow>;
      admin_notes: Tbl<AdminNoteRow>;
      follow_ups: Tbl<FollowUpRow>;
      email_messages: Tbl<EmailMessageRow>;
      email_events: Tbl<EmailEventRow>;
      email_suppressions: Tbl<EmailSuppressionRow>;
      referral_credits: Tbl<ReferralCreditRow>;
      payment_records: Tbl<PaymentRecordRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
