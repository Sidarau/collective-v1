-- Native CRM primitives: notes, follow-ups, email outbox/events/suppressions,
-- audit trail, referral credits, manual payment records.
-- Supabase = source of truth; Resend = delivery; admin app = operator console.
-- Applied to project iudicmvyihswhvgmyvcf on 2026-07-02 via Supabase MCP.

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
