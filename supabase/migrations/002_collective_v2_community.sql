-- Collective v2: gates presentation, profiles, applications, events, staff, intros
-- Recovered 2026-07-04 from the live migration history of project iudicmvyihswhvgmyvcf
-- (applied via Supabase MCP 2026-07-02, never committed as a file). Authoritative.

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
