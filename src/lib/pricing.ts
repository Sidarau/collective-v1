import { getSupabaseAdmin } from "./supabase";

interface SeasonalPrice {
  price_per_night: number;
  currency: string;
}

interface RoomPrice {
  base_price_per_night: number;
  currency: string;
}

export async function getRoomPriceForDate(
  roomId: string,
  date: Date
): Promise<{ price: number; currency: string }> {
  const dateStr = date.toISOString().split("T")[0];

  // Check seasonal pricing first
  const { data: seasonal } = await getSupabaseAdmin()
    .from("seasonal_pricing")
    .select("price_per_night, currency")
    .eq("room_id", roomId)
    .lte("start_date", dateStr)
    .gte("end_date", dateStr)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (seasonal) {
    const s = seasonal as SeasonalPrice;
    return { price: s.price_per_night, currency: s.currency };
  }

  // Fallback to room base price
  const { data: room } = await getSupabaseAdmin()
    .from("rooms")
    .select("base_price_per_night, currency")
    .eq("id", roomId)
    .single();

  const r = room as RoomPrice | null;
  return {
    price: r?.base_price_per_night || 0,
    currency: r?.currency || "EUR",
  };
}

export async function calculateBookingTotal(
  roomId: string,
  checkIn: string,
  checkOut: string
): Promise<{ total: number; currency: string; nights: number }> {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  let total = 0;
  let currency = "EUR";

  for (let i = 0; i < nights; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const { price, currency: c } = await getRoomPriceForDate(roomId, date);
    total += price;
    currency = c;
  }

  return { total, currency, nights };
}
