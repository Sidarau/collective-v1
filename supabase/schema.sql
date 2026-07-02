-- Collective V1 Supabase Schema
-- Run this in the Supabase Dashboard SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Villas
CREATE TABLE IF NOT EXISTS public.villas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  max_guests INTEGER DEFAULT 8,
  images TEXT[] DEFAULT '{}',
  amenities TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  villa_id UUID NOT NULL REFERENCES public.villas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  room_type TEXT NOT NULL CHECK (room_type IN ('single', 'double', 'suite', 'master')),
  max_guests INTEGER DEFAULT 2,
  bed_type TEXT,
  images TEXT[] DEFAULT '{}',
  amenities TEXT[] DEFAULT '{}',
  base_price_per_night INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(villa_id, slug)
);

-- Seasonal pricing
CREATE TABLE IF NOT EXISTS public.seasonal_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price_per_night INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  min_nights INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  hubspot_contact_id TEXT,
  hubspot_deal_id TEXT,
  dietary_restrictions TEXT,
  notes TEXT,
  source TEXT DEFAULT 'website',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'active', 'inactive', 'blacklisted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (linked to leads for portal access)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'lead' CHECK (role IN ('lead', 'member', 'admin', 'operator')),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Magic tokens for passwordless login
CREATE TABLE IF NOT EXISTS public.magic_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_token ON public.magic_tokens(token);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_user_id ON public.magic_tokens(user_id);

-- Bookings
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  villa_id UUID NOT NULL REFERENCES public.villas(id) ON DELETE CASCADE,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INTEGER DEFAULT 1,
  guest_names TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('inquiry', 'requested', 'approved', 'deposit_paid', 'paid', 'confirmed', 'cancelled', 'completed')),
  total_price INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  special_requests TEXT,
  operator_notes TEXT,
  hubspot_deal_id TEXT,
  stripe_payment_intent_id TEXT,
  invoice_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bookings_lead_id ON public.bookings(lead_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON public.bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_hubspot_deal_id ON public.bookings(hubspot_deal_id);

-- Availability blocks
CREATE TABLE IF NOT EXISTS public.availability_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'blocked', 'maintenance')),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  price_override INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, date)
);
CREATE INDEX IF NOT EXISTS idx_availability_blocks_room_date ON public.availability_blocks(room_id, date);
CREATE INDEX IF NOT EXISTS idx_availability_blocks_booking_id ON public.availability_blocks(booking_id);

-- RLS: Enable
ALTER TABLE public.villas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magic_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;

-- RLS: Service role bypass (used by server-side API routes)
-- Note: CREATE POLICY does not support IF NOT EXISTS.
-- Drop and recreate to make the script idempotent.
DROP POLICY IF EXISTS service_all ON public.villas;
CREATE POLICY service_all ON public.villas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_all ON public.rooms;
CREATE POLICY service_all ON public.rooms FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_all ON public.seasonal_pricing;
CREATE POLICY service_all ON public.seasonal_pricing FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_all ON public.leads;
CREATE POLICY service_all ON public.leads FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_all ON public.users;
CREATE POLICY service_all ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_all ON public.magic_tokens;
CREATE POLICY service_all ON public.magic_tokens FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_all ON public.bookings;
CREATE POLICY service_all ON public.bookings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_all ON public.availability_blocks;
CREATE POLICY service_all ON public.availability_blocks FOR ALL USING (true) WITH CHECK (true);

-- Seed Roca Llisa villa and rooms
INSERT INTO public.villas (name, slug, location, description, max_guests, amenities)
VALUES (
  'Roca Llisa',
  'roca-llisa',
  'Ibiza, Spain',
  'A private Mediterranean villa curated for intimate group stays.',
  8,
  ARRAY['Pool', 'Sea views', 'Chef kitchen', 'WiFi', 'Air conditioning']
)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  target_villa_id UUID;
BEGIN
  SELECT id INTO target_villa_id FROM public.villas WHERE slug = 'roca-llisa' LIMIT 1;

  IF target_villa_id IS NOT NULL THEN
    INSERT INTO public.rooms (villa_id, name, slug, description, room_type, max_guests, bed_type, base_price_per_night, currency, amenities)
    VALUES
      (target_villa_id, 'Master Suite', 'master-suite', 'Spacious master with ensuite and terrace.', 'master', 2, 'King', 45000, 'EUR', ARRAY['Ensuite', 'Terrace', 'Sea view']),
      (target_villa_id, 'Double Room', 'double-room', 'Bright double room with garden view.', 'double', 2, 'Queen', 32000, 'EUR', ARRAY['Garden view']),
      (target_villa_id, 'Twin Room', 'twin-room', 'Flexible twin setup, ideal for friends.', 'single', 2, 'Twin', 28000, 'EUR', ARRAY['Pool view'])
    ON CONFLICT (villa_id, slug) DO NOTHING;
  END IF;
END $$;

-- Updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS villas_updated_at ON public.villas;
CREATE TRIGGER villas_updated_at BEFORE UPDATE ON public.villas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS rooms_updated_at ON public.rooms;
CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS leads_updated_at ON public.leads;
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS bookings_updated_at ON public.bookings;
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS availability_blocks_updated_at ON public.availability_blocks;
CREATE TRIGGER availability_blocks_updated_at BEFORE UPDATE ON public.availability_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
