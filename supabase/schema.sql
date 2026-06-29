-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Villas table
CREATE TABLE IF NOT EXISTS villas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    location TEXT NOT NULL,
    description TEXT,
    max_guests INTEGER NOT NULL DEFAULT 1,
    images TEXT[] DEFAULT '{}',
    amenities TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    villa_id UUID NOT NULL REFERENCES villas(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    room_type TEXT NOT NULL CHECK (room_type IN ('single', 'double', 'suite', 'master')),
    max_guests INTEGER NOT NULL DEFAULT 1,
    bed_type TEXT,
    images TEXT[] DEFAULT '{}',
    amenities TEXT[] DEFAULT '{}',
    base_price_per_night INTEGER NOT NULL DEFAULT 0, -- in cents
    currency TEXT NOT NULL DEFAULT 'EUR',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(villa_id, slug)
);

-- Seasonal pricing table
CREATE TABLE IF NOT EXISTS seasonal_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    price_per_night INTEGER NOT NULL, -- in cents
    currency TEXT NOT NULL DEFAULT 'EUR',
    min_nights INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (end_date >= start_date)
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    whatsapp TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    hubspot_contact_id TEXT,
    hubspot_deal_id TEXT,
    dietary_restrictions TEXT,
    notes TEXT,
    source TEXT NOT NULL DEFAULT 'website',
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'active', 'inactive', 'blacklisted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (for auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'lead' CHECK (role IN ('lead', 'member', 'admin', 'operator')),
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    villa_id UUID NOT NULL REFERENCES villas(id) ON DELETE CASCADE,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    guests INTEGER NOT NULL DEFAULT 1,
    guest_names TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'inquiry' CHECK (status IN ('inquiry', 'requested', 'approved', 'deposit_paid', 'paid', 'confirmed', 'cancelled', 'completed')),
    total_price INTEGER NOT NULL DEFAULT 0, -- in cents
    currency TEXT NOT NULL DEFAULT 'EUR',
    special_requests TEXT,
    hubspot_deal_id TEXT,
    stripe_payment_intent_id TEXT,
    invoice_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (check_out > check_in)
);

-- Availability blocks table
CREATE TABLE IF NOT EXISTS availability_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'blocked', 'maintenance')),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    price_override INTEGER, -- in cents, nullable
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_lead ON bookings(lead_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_availability_room_date ON availability_blocks(room_id, date);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_hubspot ON leads(hubspot_contact_id);

-- Enable RLS (Row Level Security)
ALTER TABLE villas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_blocks ENABLE ROW LEVEL SECURITY;

-- RLS policies: leads can read their own data
CREATE POLICY IF NOT EXISTS leads_read_own ON leads
    FOR SELECT USING (auth.uid() IN (SELECT id FROM users WHERE lead_id = leads.id));

-- RLS policies: everyone can read villas and rooms
CREATE POLICY IF NOT EXISTS villas_read_all ON villas FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS rooms_read_all ON rooms FOR SELECT USING (true);

-- RLS policies: leads can read their own bookings
CREATE POLICY IF NOT EXISTS bookings_read_own ON bookings
    FOR SELECT USING (auth.uid() IN (SELECT id FROM users WHERE lead_id = bookings.lead_id));

-- RLS policies: admin/operator can read all
CREATE POLICY IF NOT EXISTS bookings_read_admin ON bookings
    FOR SELECT USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('admin', 'operator')));
CREATE POLICY IF NOT EXISTS leads_read_admin ON leads
    FOR SELECT USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('admin', 'operator')));
