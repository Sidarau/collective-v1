export interface Villa {
  id: string;
  name: string;
  slug: string;
  location: string;
  description: string | null;
  max_guests: number;
  images: string[];
  amenities: string[];
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  villa_id: string;
  name: string;
  slug: string;
  description: string | null;
  room_type: "single" | "double" | "suite" | "master";
  max_guests: number;
  bed_type: string | null;
  images: string[];
  amenities: string[];
  base_price_per_night: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  first_name: string;
  last_name: string;
  hubspot_contact_id: string | null;
  hubspot_deal_id: string | null;
  dietary_restrictions: string | null;
  notes: string | null;
  source: string;
  status: "new" | "active" | "inactive" | "blacklisted";
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  role: "lead" | "member" | "admin" | "operator";
  lead_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  lead_id: string;
  room_id: string;
  villa_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  guest_names: string[];
  status: "inquiry" | "requested" | "approved" | "deposit_paid" | "paid" | "confirmed" | "cancelled" | "completed";
  total_price: number;
  currency: string;
  special_requests: string | null;
  operator_notes: string | null;
  hubspot_deal_id: string | null;
  stripe_payment_intent_id: string | null;
  invoice_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvailabilityBlock {
  id: string;
  room_id: string;
  date: string;
  status: "available" | "booked" | "blocked" | "maintenance";
  booking_id: string | null;
  price_override: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MagicToken {
  id: string;
  user_id: string;
  token: string;
  used: boolean;
  expires_at: string;
  created_at: string;
}

export interface BookingRow {
  id: string;
  status: string;
  check_in: string;
  check_out: string;
  guests: number;
  total_price: number;
  currency: string;
  created_at: string;
  leads: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  rooms: {
    name: string;
  } | null;
}

export interface AdminStats {
  pendingRequests: number;
  totalBookings: number;
  revenue: number;
}
