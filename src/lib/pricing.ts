import { supabaseAdmin } from "./supabase";

export async function getRoomPriceForDate(
  roomId: string,
  date: Date
): Promise<{ price: number; currency: string }> {
  const dateStr = date.toISOString().split("T")[0];

  // Check seasonal pricing first
  const { data: seasonal } = await supabaseAdmin
    .from("seasonal_pricing")
    .select("price_per_night, currency")
    .eq("room_id", roomId)
    .lte("start_date", dateStr)
    .gte("end_date", dateStr)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (seasonal) {
    return { price: seasonal.price_per_night, currency: seasonal.currency };
  }

  // Fallback to room base price
  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("base_price_per_night, currency")
    .eq("id", roomId)
    .single();

  return {
    price: room?.base_price_per_night || 0,
    currency: room?.currency || "EUR",
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
