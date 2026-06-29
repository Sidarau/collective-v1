export interface Villa {
  id: string;
  name: string;
  slug: string;
  location: string;
  description: string;
  maxGuests: number;
  images: string[];
  amenities: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  villaId: string;
  name: string;
  slug: string;
  description: string;
  roomType: 'single' | 'double' | 'suite' | 'master';
  maxGuests: number;
  bedType: string;
  images: string[];
  amenities: string[];
  basePricePerNight: number; // in cents
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeasonalPricing {
  id: string;
  roomId: string;
  name: string; // e.g. "Summer 2026"
  startDate: string; // ISO date
  endDate: string;
  pricePerNight: number; // in cents
  currency: string;
  minNights: number;
  createdAt: string;
}

export interface Lead {
  id: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  firstName: string;
  lastName: string;
  hubspotContactId?: string;
  hubspotDealId?: string;
  dietaryRestrictions?: string;
  notes?: string;
  source: string; // e.g. "whatsapp", "referral", "website"
  status: 'new' | 'active' | 'inactive' | 'blacklisted';
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  leadId: string;
  roomId: string;
  villaId: string;
  checkIn: string; // ISO date
  checkOut: string;
  guests: number;
  guestNames?: string[];
  status: 'inquiry' | 'requested' | 'approved' | 'deposit_paid' | 'paid' | 'confirmed' | 'cancelled' | 'completed';
  totalPrice: number; // in cents
  currency: string;
  specialRequests?: string;
  hubspotDealId?: string;
  stripePaymentIntentId?: string;
  invoiceUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityBlock {
  id: string;
  roomId: string;
  date: string; // ISO date
  status: 'available' | 'booked' | 'blocked' | 'maintenance';
  bookingId?: string;
  priceOverride?: number; // in cents, nullable
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  role: 'lead' | 'member' | 'admin' | 'operator';
  leadId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingRequest {
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  guestNames?: string[];
  specialRequests?: string;
}
