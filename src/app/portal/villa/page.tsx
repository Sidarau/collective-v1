"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "../../../lib/supabase";
import { config } from "../../../lib/config";

export default function VillaPage() {
  const [villa, setVilla] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();
    async function load() {
      const { data: villaData } = await supabase
        .from("villas")
        .select("*")
        .eq("slug", "roca-llisa")
        .single();
      const { data: roomsData } = await supabase
        .from("rooms")
        .select("*")
        .eq("villa_id", villaData?.id);
      setVilla(villaData);
      setRooms(roomsData || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-8">Loading villa...</div>;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-800">{config.brandName}</h1>
        <nav className="space-x-4 text-sm">
          <Link href="/portal/villa" className="text-stone-600 hover:text-stone-900">Villa</Link>
          <Link href="/portal/rooms" className="text-stone-600 hover:text-stone-900">Rooms</Link>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h2 className="text-3xl font-light text-stone-900 mb-2">{villa?.name || config.villaName}</h2>
        <p className="text-stone-500 mb-6">{villa?.location || config.villaLocation}</p>
        <p className="text-stone-700 leading-relaxed mb-10">{villa?.description || config.villaDescription}</p>

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
