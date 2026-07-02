export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      villas: {
        Row: {
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
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          location: string;
          description?: string | null;
          max_guests?: number;
          images?: string[];
          amenities?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          location?: string;
          description?: string | null;
          max_guests?: number;
          images?: string[];
          amenities?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      rooms: {
        Row: {
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
        };
        Insert: {
          id?: string;
          villa_id: string;
          name: string;
          slug: string;
          description?: string | null;
          room_type: "single" | "double" | "suite" | "master";
          max_guests?: number;
          bed_type?: string | null;
          images?: string[];
          amenities?: string[];
          base_price_per_night?: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          villa_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          room_type?: "single" | "double" | "suite" | "master";
          max_guests?: number;
          bed_type?: string | null;
          images?: string[];
          amenities?: string[];
          base_price_per_night?: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      seasonal_pricing: {
        Row: {
          id: string;
          room_id: string;
          name: string;
          start_date: string;
          end_date: string;
          price_per_night: number;
          currency: string;
          min_nights: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          name: string;
          start_date: string;
          end_date: string;
          price_per_night: number;
          currency?: string;
          min_nights?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          name?: string;
          start_date?: string;
          end_date?: string;
          price_per_night?: number;
          currency?: string;
          min_nights?: number;
          created_at?: string;
        };
      };
      leads: {
        Row: {
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
        };
        Insert: {
          id?: string;
          email: string;
          phone?: string | null;
          whatsapp?: string | null;
          first_name: string;
          last_name: string;
          hubspot_contact_id?: string | null;
          hubspot_deal_id?: string | null;
          dietary_restrictions?: string | null;
          notes?: string | null;
          source?: string;
          status?: "new" | "active" | "inactive" | "blacklisted";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          phone?: string | null;
          whatsapp?: string | null;
          first_name?: string;
          last_name?: string;
          hubspot_contact_id?: string | null;
          hubspot_deal_id?: string | null;
          dietary_restrictions?: string | null;
          notes?: string | null;
          source?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          role: "lead" | "member" | "admin" | "operator";
          lead_id: string | null;
          password_hash: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          role?: "lead" | "member" | "admin" | "operator";
          lead_id?: string | null;
          password_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: "lead" | "member" | "admin" | "operator";
          lead_id?: string | null;
          password_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      bookings: {
        Row: {
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
        };
        Insert: {
          id?: string;
          lead_id: string;
          room_id: string;
          villa_id: string;
          check_in: string;
          check_out: string;
          guests?: number;
          guest_names?: string[];
          status?: "inquiry" | "requested" | "approved" | "deposit_paid" | "paid" | "confirmed" | "cancelled" | "completed";
          total_price?: number;
          currency?: string;
          special_requests?: string | null;
          operator_notes?: string | null;
          hubspot_deal_id?: string | null;
          stripe_payment_intent_id?: string | null;
          invoice_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          room_id?: string;
          villa_id?: string;
          check_in?: string;
          check_out?: string;
          guests?: number;
          guest_names?: string[];
          status?: "inquiry" | "requested" | "approved" | "deposit_paid" | "paid" | "confirmed" | "cancelled" | "completed";
          total_price?: number;
          currency?: string;
          special_requests?: string | null;
          operator_notes?: string | null;
          hubspot_deal_id?: string | null;
          stripe_payment_intent_id?: string | null;
          invoice_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      availability_blocks: {
        Row: {
          id: string;
          room_id: string;
          date: string;
          status: "available" | "booked" | "blocked" | "maintenance";
          booking_id: string | null;
          price_override: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          date: string;
          status?: "available" | "booked" | "blocked" | "maintenance";
          booking_id?: string | null;
          price_override?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          date?: string;
          status?: "available" | "booked" | "blocked" | "maintenance";
          booking_id?: string | null;
          price_override?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      magic_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          used: boolean;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          used?: boolean;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          used?: boolean;
          expires_at?: string;
          created_at?: string;
        };
      };
    };
  };
}
