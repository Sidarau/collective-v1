-- MVP 1.1: closures (open-ended availability blocking), displayed-vs-hard
-- event capacity, phone identity + WhatsApp invites, per-admin agent tokens.
-- Applied to evviegqieqdmlxixwwxt via pooler on 2026-07-07.

BEGIN;

-- Events: `capacity` is what members see; `hard_capacity` is the hidden
-- operational limit RSVPs are actually allowed to reach (NULL = same as capacity).
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS hard_capacity INTEGER;

-- Closures: villa- or room-level, optionally open-ended (ends_on NULL = forever).
CREATE TABLE IF NOT EXISTS public.closure_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  villa_id UUID REFERENCES public.villas(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  starts_on DATE NOT NULL,
  ends_on DATE,
  reason TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (villa_id IS NOT NULL OR room_id IS NOT NULL),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS idx_closures_villa ON public.closure_periods(villa_id);
CREATE INDEX IF NOT EXISTS idx_closures_room ON public.closure_periods(room_id);
ALTER TABLE public.closure_periods ENABLE ROW LEVEL SECURITY;

-- Phone identity (E.164). Linked to the email account; delivery channel for invites.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone) WHERE phone IS NOT NULL;

-- WhatsApp/phone invites: token redeemed at /welcome/[token] on the member app.
-- member_returning = stayed before -> skip application + screening, straight to
-- email capture + password. member_new = normal application funnel with phone attached.
CREATE TABLE IF NOT EXISTS public.invite_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('member_returning', 'member_new')),
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  note TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  used_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON public.invite_tokens(token);
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;

-- Per-admin agent tokens for Operator OS MCP/REST (max 3 active per admin,
-- enforced in the action). Stored as sha256 hashes; prefix kept for display.
CREATE TABLE IF NOT EXISTS public.agent_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_tokens_admin ON public.agent_tokens(admin_id);
ALTER TABLE public.agent_tokens ENABLE ROW LEVEL SECURITY;

COMMIT;
