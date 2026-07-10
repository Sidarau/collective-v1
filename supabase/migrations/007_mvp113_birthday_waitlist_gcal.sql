-- MVP 1.1.3: birthdays everywhere, waiting-list bookings, Google Calendar 2-way sync
BEGIN;

-- Birthday on every person-shaped record (bday letters, ops context).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.event_guest_rsvps ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS birthday DATE;

-- Waiting-list stay requests: recorded interest that never blocks a room.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('inquiry','requested','waitlisted','approved','deposit_paid','paid','confirmed','cancelled','completed'));

-- Google Calendar event ids per connected admin: {"<adminId>": "<eventId>"}.
ALTER TABLE public.screening_calls ADD COLUMN IF NOT EXISTS google_event_ids JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
