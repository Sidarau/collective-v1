-- =====================================================================
-- Collective — schema catch-up for the collective@zeuglab.com project
-- (ref: evviegqieqdmlxixwwxt) — brings it from migration 001 up to 005.
--
-- WHY: the app was built/verified against a DIFFERENT Supabase project
-- (iudicmvyihswhvgmyvcf, personal-gmail org). The real Collective project
-- (this one) still only had the 001 base schema (users/villas/rooms/
-- bookings/leads). This applies migrations 002+003+004+005 — all ADDITIVE
-- (new tables + ADD COLUMN + seeds) — so existing rows are preserved.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL Editor for the
-- evviegqieqdmlxixwwxt project and Run. It is wrapped in a transaction:
-- if anything fails, nothing is applied. Safe to run once on a 001-level DB.
-- (Re-running will error on CREATE TABLE — that's expected; it's one-shot.)
--
-- Generated 2026-07-04, byte-exact from the live migration history of the
-- gmail project (the known-good, fully-migrated schema). Includes the
-- `media` storage bucket and the anon-policy RLS hardening.
-- =====================================================================

BEGIN;


-- ============================================================
-- migration: 002_collective_v2_community
-- ===============================================================
-- Collective v2: gates presentation, profiles, applications, events, staff, intros

-- Villas become "Gates" in the product; presentation + publishing fields
ALTER TABLE public.villas
  ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'coming_soon', 'archived')),
  ADD COLUMN tagline TEXT,
  ADD COLUMN story TEXT,
  ADD COLUMN hero_image TEXT,
  ADD COLUMN region TEXT,
  ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Member profiles (person-first identity, editable after onboarding)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  headline TEXT,
  location TEXT,
  bio TEXT,
  motivation TEXT,
  contribution TEXT,
  links JSONB NOT NULL DEFAULT '[]',
  allergies TEXT,
  dietary TEXT,
  phone TEXT,
  whatsapp TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  visibility TEXT NOT NULL DEFAULT 'members' CHECK (visibility IN ('members', 'hidden')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);

-- Membership applications (person-first funnel: submitted -> screening -> approved/rejected/waitlist)
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  location TEXT,
  occupation TEXT,
  motivation TEXT,
  contribution TEXT,
  referred_by TEXT,
  instagram TEXT,
  linkedin TEXT,
  links JSONB NOT NULL DEFAULT '[]',
  preferred_window TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'screening', 'approved', 'rejected', 'waitlist')),
  admin_notes TEXT,
  hubspot_contact_id TEXT,
  hubspot_deal_id TEXT,
  hubspot_synced BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_applications_status ON public.applications(status);
CREATE INDEX idx_applications_email ON public.applications(email);

-- Events at Gates
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  villa_id UUID REFERENCES public.villas(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'gathering' CHECK (event_type IN ('dinner', 'experience', 'session', 'gathering', 'wellness')),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  capacity INTEGER,
  image TEXT,
  location_note TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'cancelled')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_events_villa_start ON public.events(villa_id, start_at);
CREATE INDEX idx_events_status ON public.events(status);

CREATE TABLE public.event_rsvps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'interested', 'declined')),
  guests INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);
CREATE INDEX idx_event_rsvps_event ON public.event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_user ON public.event_rsvps(user_id);

-- Staff application funnel (separate from membership)
CREATE TABLE public.staff_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role_applied TEXT NOT NULL,
  experience TEXT,
  links JSONB NOT NULL DEFAULT '[]',
  message TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'review', 'shortlisted', 'rejected', 'hired')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_staff_applications_status ON public.staff_applications(status);

-- Member-to-member introduction requests (concierge queue)
CREATE TABLE public.intro_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'declined', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_user, to_user)
);

-- Stay requests: +1 companion + optional link to originating user/event
ALTER TABLE public.bookings
  ADD COLUMN user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN companion_name TEXT,
  ADD COLUMN event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
CREATE INDEX idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX idx_bookings_dates ON public.bookings(room_id, check_in, check_out);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intro_requests ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER applications_updated_at BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER event_rsvps_updated_at BEFORE UPDATE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER staff_applications_updated_at BEFORE UPDATE ON public.staff_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER intro_requests_updated_at BEFORE UPDATE ON public.intro_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===========================================================
-- migration: 003_native_crm
-- ===========================================================
-- Native CRM primitives: notes, follow-ups, email outbox/events/suppressions,
-- audit trail, referral credits, manual payment records.
-- Supabase = source of truth; Resend = delivery; admin app = operator console.

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  summary TEXT,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

CREATE TABLE public.admin_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  author_email TEXT,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_admin_notes_entity ON public.admin_notes(entity_type, entity_id);

CREATE TABLE public.follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  owner_email TEXT,
  entity_type TEXT,
  entity_id UUID,
  title TEXT NOT NULL,
  due_at DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_follow_ups_status_due ON public.follow_ups(status, due_at);

CREATE TABLE public.email_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_email TEXT NOT NULL,
  template TEXT,
  subject TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  resend_id TEXT,
  status TEXT NOT NULL DEFAULT 'logged' CHECK (status IN ('logged', 'queued', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'suppressed')),
  error TEXT,
  meta JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_email_messages_to ON public.email_messages(to_email);
CREATE INDEX idx_email_messages_entity ON public.email_messages(entity_type, entity_id);
CREATE INDEX idx_email_messages_resend ON public.email_messages(resend_id);

CREATE TABLE public.email_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_message_id UUID REFERENCES public.email_messages(id) ON DELETE SET NULL,
  resend_id TEXT,
  to_email TEXT,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_email_events_resend ON public.email_events(resend_id);

CREATE TABLE public.email_suppressions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint', 'manual')),
  note TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.referral_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  referred_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'eligible', 'redeemed', 'void')),
  reward TEXT NOT NULL DEFAULT 'one_free_night',
  redeemed_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_referral_credits_referrer ON public.referral_credits(referrer_user_id);

CREATE TABLE public.payment_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('deposit', 'balance', 'refund', 'other')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  method TEXT,
  reference TEXT,
  note TEXT,
  recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_payment_records_booking ON public.payment_records(booking_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER admin_notes_updated_at BEFORE UPDATE ON public.admin_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER follow_ups_updated_at BEFORE UPDATE ON public.follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER email_messages_updated_at BEFORE UPDATE ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER referral_credits_updated_at BEFORE UPDATE ON public.referral_credits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ===========================================================
-- migration: 004_roca_llisa_nine_rooms
-- ===========================================================
-- Real Roca Llisa inventory: the estate tracks 9 numbered rooms (Room 1-9,
-- single/double mix per the Mastery Estate rentals sheet). Preserve the three
-- existing rows (they carry booking/availability FKs) by renaming them, then
-- add Rooms 4-9. Copy/photos are placeholders to refine in the console.
DO $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.villas WHERE slug = 'roca-llisa' LIMIT 1;
  IF v_id IS NULL THEN RETURN; END IF;

  UPDATE public.rooms SET name = 'Room 1 — Master Suite', slug = 'room-1', room_type = 'master',
    bed_type = 'King', max_guests = 2, base_price_per_night = 45000,
    description = COALESCE(description, 'Spacious master with ensuite and terrace.')
    WHERE villa_id = v_id AND slug = 'master-suite';

  UPDATE public.rooms SET name = 'Room 2 — Garden Double', slug = 'room-2', room_type = 'double',
    bed_type = 'Queen', max_guests = 2, base_price_per_night = 35000
    WHERE villa_id = v_id AND slug = 'double-room';

  UPDATE public.rooms SET name = 'Room 3 — Pine Twin', slug = 'room-3', room_type = 'single',
    bed_type = 'Twin', max_guests = 2, base_price_per_night = 28000
    WHERE villa_id = v_id AND slug = 'twin-room';

  INSERT INTO public.rooms (villa_id, name, slug, description, room_type, max_guests, bed_type, base_price_per_night, currency, amenities, images)
  VALUES
    (v_id, 'Room 4 — Sea Double', 'room-4', 'East-facing double with morning light. Details from the house soon.', 'double', 2, 'Queen', 35000, 'EUR', ARRAY['Sea view'], ARRAY['https://images.unsplash.com/photo-1595576508898-0ad5c879a061?q=80&w=1800&auto=format&fit=crop']),
    (v_id, 'Room 5 — Terrace Double', 'room-5', 'Opens onto the upper terrace. Details from the house soon.', 'double', 2, 'Queen', 35000, 'EUR', ARRAY['Terrace'], ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1800&auto=format&fit=crop']),
    (v_id, 'Room 6 — Olive Double', 'room-6', 'Quiet double over the olive garden. Details from the house soon.', 'double', 2, 'Queen', 32000, 'EUR', ARRAY['Garden view'], ARRAY['https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=1800&auto=format&fit=crop']),
    (v_id, 'Room 7 — Studio Twin', 'room-7', 'Flexible twin near the studio. Details from the house soon.', 'single', 2, 'Twin', 28000, 'EUR', ARRAY['Pool view'], ARRAY['https://images.unsplash.com/photo-1595576508898-0ad5c879a061?q=80&w=1800&auto=format&fit=crop']),
    (v_id, 'Room 8 — Court Twin', 'room-8', 'Twin beside the inner court. Details from the house soon.', 'single', 2, 'Twin', 28000, 'EUR', ARRAY['Courtyard'], ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1800&auto=format&fit=crop']),
    (v_id, 'Room 9 — West Twin', 'room-9', 'Sunset-side twin. Details from the house soon.', 'single', 2, 'Twin', 28000, 'EUR', ARRAY['Sunset view'], ARRAY['https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=1800&auto=format&fit=crop'])
  ON CONFLICT (villa_id, slug) DO NOTHING;

  UPDATE public.villas SET max_guests = 18 WHERE id = v_id;
END $$;

SELECT slug, name, room_type, base_price_per_night FROM public.rooms ORDER BY slug;


-- ===========================================================
-- migration: admin_console_os
-- ===========================================================
-- Admin console v3 (ZEUG-418): referral funnels, screening-call scheduling,
-- knowledge base, email campaigns, notification settings, content blocks,
-- media storage bucket, and RLS hardening.

-- ---------------------------------------------------- Referral links

CREATE TABLE public.referral_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('member', 'vendor')),
  label TEXT NOT NULL,
  note TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_referral_links_code ON public.referral_links(code) WHERE active;

-- ----------------------------------------------------- Screening scheduling

CREATE TABLE public.screening_windows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind TEXT NOT NULL DEFAULT 'both' CHECK (kind IN ('member', 'vendor', 'both')),
  weekday SMALLINT CHECK (weekday BETWEEN 0 AND 6),
  date DATE,
  start_minute INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute INTEGER NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  slot_minutes INTEGER NOT NULL DEFAULT 15 CHECK (slot_minutes BETWEEN 5 AND 120),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_minute > start_minute),
  CHECK (weekday IS NOT NULL OR date IS NOT NULL)
);

CREATE TABLE public.screening_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind TEXT NOT NULL CHECK (kind IN ('member', 'vendor')),
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  staff_application_id UUID REFERENCES public.staff_applications(id) ON DELETE CASCADE,
  prospect_name TEXT NOT NULL,
  prospect_email TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 15,
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'no_show', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (application_id IS NOT NULL AND staff_application_id IS NULL) OR
    (application_id IS NULL AND staff_application_id IS NOT NULL)
  )
);
CREATE INDEX idx_screening_calls_scheduled ON public.screening_calls(scheduled_at);
CREATE INDEX idx_screening_calls_application ON public.screening_calls(application_id);
CREATE INDEX idx_screening_calls_staff_application ON public.screening_calls(staff_application_id);

ALTER TABLE public.applications
  ADD COLUMN screening_token TEXT UNIQUE,
  ADD COLUMN referral_link_id UUID REFERENCES public.referral_links(id) ON DELETE SET NULL;

ALTER TABLE public.staff_applications
  ADD COLUMN interview_token TEXT UNIQUE,
  ADD COLUMN referral_link_id UUID REFERENCES public.referral_links(id) ON DELETE SET NULL,
  ADD COLUMN company TEXT;

ALTER TABLE public.staff_applications DROP CONSTRAINT IF EXISTS staff_applications_status_check;
ALTER TABLE public.staff_applications
  ADD CONSTRAINT staff_applications_status_check
  CHECK (status IN ('submitted', 'review', 'interview_scheduled', 'interviewed', 'shortlisted', 'hired', 'rejected'));

-- ----------------------------------------------------- Knowledge base

CREATE TABLE public.kb_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES public.kb_nodes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'doc' CHECK (kind IN ('folder', 'doc')),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  body_md TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'staff', 'members')),
  position INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_kb_nodes_parent_slug
  ON public.kb_nodes(COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);
CREATE INDEX idx_kb_nodes_parent ON public.kb_nodes(parent_id);

-- ----------------------------------------------------- Email campaigns + settings

CREATE TABLE public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  heading TEXT NOT NULL DEFAULT '',
  body_md TEXT NOT NULL DEFAULT '',
  cta_href TEXT,
  cta_label TEXT,
  audience JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'cancelled')),
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------- Content blocks

CREATE TABLE public.content_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body_md TEXT NOT NULL DEFAULT '',
  media JSONB NOT NULL DEFAULT '[]',
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------- Storage

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------- RLS

ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screening_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screening_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_all ON public.villas;
DROP POLICY IF EXISTS service_all ON public.rooms;
DROP POLICY IF EXISTS service_all ON public.seasonal_pricing;
DROP POLICY IF EXISTS service_all ON public.leads;
DROP POLICY IF EXISTS service_all ON public.users;
DROP POLICY IF EXISTS service_all ON public.magic_tokens;
DROP POLICY IF EXISTS service_all ON public.bookings;
DROP POLICY IF EXISTS service_all ON public.availability_blocks;
DROP POLICY IF EXISTS service_all ON public.profiles;
DROP POLICY IF EXISTS service_all ON public.applications;
DROP POLICY IF EXISTS service_all ON public.events;
DROP POLICY IF EXISTS service_all ON public.event_rsvps;
DROP POLICY IF EXISTS service_all ON public.staff_applications;
DROP POLICY IF EXISTS service_all ON public.intro_requests;

-- ----------------------------------------------------- Triggers

CREATE TRIGGER referral_links_updated_at BEFORE UPDATE ON public.referral_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER screening_windows_updated_at BEFORE UPDATE ON public.screening_windows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER screening_calls_updated_at BEFORE UPDATE ON public.screening_calls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER kb_nodes_updated_at BEFORE UPDATE ON public.kb_nodes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER email_campaigns_updated_at BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER content_blocks_updated_at BEFORE UPDATE ON public.content_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------- Seeds

INSERT INTO public.referral_links (code, kind, label, note)
VALUES
  ('founding-circle', 'member', 'Founding circle', 'Default member referral link — share with prospects'),
  ('vendors', 'vendor', 'Vendors & staff', 'Default vendor application link')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES
  ('notify.admin_on_application', '{"enabled": true}'),
  ('notify.admin_on_vendor_application', '{"enabled": true}'),
  ('notify.admin_on_booking_request', '{"enabled": true}'),
  ('notify.prospect_on_screening_booked', '{"enabled": true}'),
  ('notify.admin_on_screening_booked', '{"enabled": true}')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  sops_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kb_nodes) THEN
    INSERT INTO public.kb_nodes (kind, title, slug, position, visibility)
    VALUES ('folder', 'Collective OS', 'collective-os', 0, 'internal')
    RETURNING id INTO sops_id;

    INSERT INTO public.kb_nodes (parent_id, kind, title, slug, position, visibility, body_md)
    VALUES
      (sops_id, 'folder', 'SOPs', 'sops', 0, 'internal', ''),
      (sops_id, 'folder', 'House — Roca Llisa', 'house-roca-llisa', 1, 'staff', ''),
      (sops_id, 'folder', 'Vendors & Services', 'vendors-services', 2, 'internal', ''),
      (sops_id, 'doc', 'Welcome', 'welcome', 3, 'internal',
       E'# Collective OS\n\nThis is the owned knowledge base — the Notion replacement. Tree on the left, markdown here.\n\n- **internal** docs: operators only\n- **staff** docs: visible to staff via the staff portal (coming)\n- **members** docs: visible to members (coming)\n\nAgents can read/write via the KB API — see Settings for the token.');
  END IF;
END $$;

INSERT INTO public.content_blocks (key, title, body_md)
VALUES
  ('landing.hero', 'Landing hero', 'A private circle around the world''s quiet places.'),
  ('join.intro', 'Application intro', 'Introductions are personal. Tell us who you are — the Circle reads every word.'),
  ('screening.intro', 'Screening intro', 'A short call — fifteen minutes with the host. Choose a window that suits you.')
ON CONFLICT (key) DO NOTHING;

COMMIT;
