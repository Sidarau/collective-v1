-- Admin console v3 (ZEUG-418): referral funnels, screening-call scheduling,
-- knowledge base, email campaigns, notification settings, content blocks,
-- media storage bucket, and RLS hardening.
--
-- All app access runs through the service-role client behind server routes
-- (service role bypasses RLS), so new tables get RLS enabled with NO
-- permissive policies. The legacy `service_all USING (true)` policies opened
-- every table to the anon/authenticated PostgREST roles for no benefit —
-- dropped here (nothing uses the anon key; verified no createBrowserClient
-- call sites).
--
-- Applied to project iudicmvyihswhvgmyvcf via Supabase MCP.

-- ---------------------------------------------------------------- Referral links

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

-- ---------------------------------------------------------------- Screening scheduling

-- Don's bookable windows. Either recurring (weekday set, 0=Sunday .. 6=Saturday,
-- matching JS Date#getDay) or one-off (date set). Minutes are minutes-of-day
-- in the window's own timezone.
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

-- One-purpose secrets that let an applicant open the public scheduling page.
ALTER TABLE public.applications
  ADD COLUMN screening_token TEXT UNIQUE,
  ADD COLUMN referral_link_id UUID REFERENCES public.referral_links(id) ON DELETE SET NULL;

ALTER TABLE public.staff_applications
  ADD COLUMN interview_token TEXT UNIQUE,
  ADD COLUMN referral_link_id UUID REFERENCES public.referral_links(id) ON DELETE SET NULL,
  ADD COLUMN company TEXT;

-- Vendor funnel gains explicit interview stages.
ALTER TABLE public.staff_applications DROP CONSTRAINT IF EXISTS staff_applications_status_check;
ALTER TABLE public.staff_applications
  ADD CONSTRAINT staff_applications_status_check
  CHECK (status IN ('submitted', 'review', 'interview_scheduled', 'interviewed', 'shortlisted', 'hired', 'rejected'));

-- ---------------------------------------------------------------- Knowledge base

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

-- ---------------------------------------------------------------- Email campaigns + settings

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

-- ---------------------------------------------------------------- Content blocks

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

-- ---------------------------------------------------------------- Storage

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------- RLS

ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screening_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screening_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;

-- Hardening: drop the anon-open policies. Service role bypasses RLS, nothing
-- else talks to PostgREST.
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

-- ---------------------------------------------------------------- Triggers

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

-- ---------------------------------------------------------------- Seeds

-- Two starter referral links so the funnel is testable immediately.
INSERT INTO public.referral_links (code, kind, label, note)
VALUES
  ('founding-circle', 'member', 'Founding circle', 'Default member referral link — share with prospects'),
  ('vendors', 'vendor', 'Vendors & staff', 'Default vendor application link')
ON CONFLICT (code) DO NOTHING;

-- Notification toggles default on (delivery still gated by EMAIL_MODE).
INSERT INTO public.app_settings (key, value)
VALUES
  ('notify.admin_on_application', '{"enabled": true}'),
  ('notify.admin_on_vendor_application', '{"enabled": true}'),
  ('notify.admin_on_booking_request', '{"enabled": true}'),
  ('notify.prospect_on_screening_booked', '{"enabled": true}'),
  ('notify.admin_on_screening_booked', '{"enabled": true}')
ON CONFLICT (key) DO NOTHING;

-- Starter KB tree (Collective OS skeleton — content migrates from Notion).
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

-- Member-app copy blocks (member app reads with graceful fallbacks).
INSERT INTO public.content_blocks (key, title, body_md)
VALUES
  ('landing.hero', 'Landing hero', 'A private circle around the world''s quiet places.'),
  ('join.intro', 'Application intro', 'Introductions are personal. Tell us who you are — the Circle reads every word.'),
  ('screening.intro', 'Screening intro', 'A short call — fifteen minutes with the host. Choose a window that suits you.')
ON CONFLICT (key) DO NOTHING;
