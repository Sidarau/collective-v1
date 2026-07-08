-- Guest/public event tier + basic compliance surfaces.
-- Public events are visible outside the member portal; guest RSVPs are kept
-- separate from member RSVPs so guests never become directory profiles until
-- an admin explicitly invites them onward.

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'member'
  CHECK (audience IN ('member', 'public'));

CREATE INDEX IF NOT EXISTS idx_events_audience_start
  ON public.events(audience, status, start_at);

CREATE TABLE IF NOT EXISTS public.event_guest_rsvps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  instagram TEXT,
  note TEXT,
  consent_terms BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'waitlist', 'cancelled')),
  invited_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, email)
);

CREATE INDEX IF NOT EXISTS idx_event_guest_rsvps_event
  ON public.event_guest_rsvps(event_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_event_guest_rsvps_email
  ON public.event_guest_rsvps(email);

ALTER TABLE public.event_guest_rsvps ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS event_guest_rsvps_updated_at ON public.event_guest_rsvps;
CREATE TRIGGER event_guest_rsvps_updated_at BEFORE UPDATE ON public.event_guest_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
