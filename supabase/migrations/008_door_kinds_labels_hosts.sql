-- 008: one-door referral system (kinds + labels), CRM labels on people,
-- per-admin screening hosts, and the default-host seed (Dominik, 13:00-14:00 daily).
-- Replaces the separate fast-track + WhatsApp-invite flows: every entrance is a door.

BEGIN;

-- Door kinds: member (application + host call), instant_member (account on the
-- spot, no screening — investor decks, QR cards), vendor / staff (hiring funnel).
ALTER TABLE public.referral_links DROP CONSTRAINT IF EXISTS referral_links_kind_check;
ALTER TABLE public.referral_links
  ADD CONSTRAINT referral_links_kind_check
  CHECK (kind IN ('member', 'instant_member', 'vendor', 'staff'));
ALTER TABLE public.referral_links ADD COLUMN IF NOT EXISTS labels TEXT[] NOT NULL DEFAULT '{}';

-- CRM labels stick to people (users for accounts, mirrored on leads for the funnel).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS labels TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS labels TEXT[] NOT NULL DEFAULT '{}';

-- invite_tokens stays for links already in the wild; new columns let any future
-- token carry prefill + attribution.
ALTER TABLE public.invite_tokens DROP CONSTRAINT IF EXISTS invite_tokens_kind_check;
ALTER TABLE public.invite_tokens
  ADD CONSTRAINT invite_tokens_kind_check
  CHECK (kind IN ('member_returning', 'member_new', 'instant_member'));
ALTER TABLE public.invite_tokens ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.invite_tokens ADD COLUMN IF NOT EXISTS labels TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.invite_tokens
  ADD COLUMN IF NOT EXISTS referral_link_id UUID REFERENCES public.referral_links(id) ON DELETE SET NULL;

-- Screening becomes per-host. NULL admin_id = shared/legacy (matches any host).
ALTER TABLE public.screening_windows
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.screening_calls
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Default host (Dominik) + his standing 13:00-14:00 daily hour, 15-minute slots.
DO $$
DECLARE don UUID;
BEGIN
  SELECT id INTO don
  FROM public.users
  WHERE email = 'dominik@mission-mastery.com' AND role = 'admin';

  IF don IS NULL THEN
    RAISE NOTICE 'default screening host not found - seed skipped';
    RETURN;
  END IF;

  INSERT INTO public.app_settings (key, value)
  VALUES ('screening.default_host', to_jsonb(don::text))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

  UPDATE public.screening_windows SET admin_id = don WHERE admin_id IS NULL;

  INSERT INTO public.screening_windows
    (kind, weekday, start_minute, end_minute, timezone, slot_minutes, active, note, admin_id)
  SELECT 'both', d, 780, 840, 'Europe/Madrid', 15, TRUE, 'Daily host hour', don
  FROM generate_series(0, 6) AS d
  WHERE NOT EXISTS (
    SELECT 1 FROM public.screening_windows w
    WHERE w.admin_id = don AND w.weekday = d
      AND w.start_minute = 780 AND w.end_minute = 840
  );
END $$;

COMMIT;
