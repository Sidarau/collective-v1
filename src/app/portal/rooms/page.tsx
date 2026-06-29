"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "../../../lib/supabase";
import { config } from "../../../lib/config";

function RoomsContent() {
  const searchParams = useSearchParams();
  const selectedRoomId = searchParams.get("room");
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [availability, setAvailability] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();
    async function load() {
      const { data: roomsData } = await supabase.from("rooms").select("*, villas(*)");
      setRooms(roomsData || []);
      if (selectedRoomId) {
        const room = roomsData?.find((r) => r.id === selectedRoomId);
        setSelectedRoom(room);
        // Load availability for next 30 days
        const today = new Date().toISOString().split("T")[0];
        const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const { data: avail } = await supabase
          .from("availability_blocks")
          .select("*")
          .eq("room_id", selectedRoomId)
          .gte("date", today)
          .lte("date", endDate);
        setAvailability(avail || []);
      }
      setLoading(false);
    }
    load();
  }, [selectedRoomId]);

  if (loading) return <div className="p-8">Loading rooms...</div>;

  if (!selectedRoom) {
    return (
      <div className="min-h-screen bg-stone-50">
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-stone-800">{config.brandName}</h1>
          <nav className="space-x-4 text-sm">
            <Link href="/portal/villa" className="text-stone-600 hover:text-stone-900">Villa</Link>
            <Link href="/portal/rooms" className="text-stone-900 font-medium">Rooms</Link>
          </nav>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-10">
          <h2 className="text-2xl font-light text-stone-900 mb-6">All Rooms</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {rooms.map((room) => (
              <Link key={room.id} href={`/portal/rooms?room=${room.id}`}>
                <div className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition">
                  <h3 className="text-lg font-medium text-stone-800">{room.name}</h3>
                  <p className="text-sm text-stone-500 capitalize mt-1">{room.room_type} • Up to {room.max_guests} guests</p>
                  <p className="text-stone-600 text-sm mt-3 line-clamp-2">{room.description}</p>
                  <p className="text-stone-900 font-medium mt-4">€{(room.base_price_per_night / 100).toFixed(0)} / night</p>
                </div>
              </Link>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Generate calendar for next 30 days
  const days: { date: string; status: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const block = availability.find((a) => a.date === dateStr);
    days.push({ date: dateStr, status: block?.status || "available" });
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-800">{config.brandName}</h1>
        <nav className="space-x-4 text-sm">
          <Link href="/portal/villa" className="text-stone-600 hover:text-stone-900">Villa</Link>
          <Link href="/portal/rooms" className="text-stone-900 font-medium">Rooms</Link>
        </nav>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <Link href="/portal/rooms" className="text-sm text-stone-500 hover:text-stone-700">← Back to all rooms</Link>
        <h2 className="text-3xl font-light text-stone-900 mt-4 mb-2">{selectedRoom.name}</h2>
        <p className="text-stone-500 capitalize mb-6">{selectedRoom.room_type} • Up to {selectedRoom.max_guests} guests</p>
        <p className="text-stone-700 mb-8">{selectedRoom.description}</p>

        <h3 className="text-lg font-medium text-stone-800 mb-4">Availability</h3>
        <div className="grid grid-cols-7 gap-2 mb-8">
          {days.map((day) => (
            <div
              key={day.date}
              className={`rounded-lg p-2 text-center text-xs border ${
                day.status === "available"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : day.status === "booked"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-stone-100 border-stone-200 text-stone-500"
              }`}
            >
              <div className="font-medium">{new Date(day.date).getDate()}</div>
              <div className="text-[10px] uppercase">{new Date(day.date).toLocaleDateString("en-US", { weekday: "short" })}</div>
            </div>
          ))}
        </div>

        <Link href={`/portal/booking?room=${selectedRoom.id}`}>
          <button className="w-full bg-stone-900 text-white py-3 rounded-lg font-medium hover:bg-stone-800 transition">
            Request This Room
          </button>
        </Link>
      </main>
    </div>
  );
}

export default function RoomsPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <RoomsContent />
    </Suspense>
  );
}
