"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "../../../lib/supabase";
import { config } from "../../../lib/config";

interface Room {
  id: string;
  name: string;
  villa_id: string;
  max_guests: number;
}

interface BookingResult {
  success?: boolean;
  error?: string;
  total?: number;
  nights?: number;
  message?: string;
}

function BookingContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room");
  const [room, setRoom] = useState<Room | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(1);
  const [specialRequests, setSpecialRequests] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    async function load() {
      if (roomId) {
        const { data } = await supabase.from("rooms").select("*").eq("id", roomId).single();
        setRoom(data as Room | null);
      }
      setLoading(false);
    }
    void load();
  }, [roomId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId || !checkIn || !checkOut || !room) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          villaId: room.villa_id,
          checkIn,
          checkOut,
          guests,
          specialRequests,
        }),
      });

      const data = (await response.json()) as BookingResult;
      setResult(data);
    } catch (err: unknown) {
      setResult({ error: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (!room) return <div className="p-8">Room not found</div>;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-800">{config.brandName}</h1>
        <nav className="space-x-4 text-sm">
          <Link href="/portal/villa" className="text-stone-600 hover:text-stone-900">Villa</Link>
          <Link href="/portal/rooms" className="text-stone-600 hover:text-stone-900">Rooms</Link>
        </nav>
      </header>

      <main className="max-w-xl mx-auto px-6 py-10">
        <Link href={`/portal/rooms?room=${room.id}`} className="text-sm text-stone-500 hover:text-stone-700">← Back to room</Link>
        <h2 className="text-2xl font-light text-stone-900 mt-4 mb-6">Request {room.name}</h2>

        {result?.success ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-emerald-800">
            <h3 className="font-medium mb-2">Request submitted!</h3>
            <p className="text-sm">{result.message}</p>
            <p className="text-sm mt-2">Total: €{result.total?.toFixed(2)} for {result.nights} nights</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
            {result?.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{result.error}</div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Check-in</label>
                <input
                  type="date"
                  required
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full rounded-lg border-stone-300 px-3 py-2 border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Check-out</label>
                <input
                  type="date"
                  required
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full rounded-lg border-stone-300 px-3 py-2 border"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Guests</label>
              <input
                type="number"
                min={1}
                max={room.max_guests}
                value={guests}
                onChange={(e) => setGuests(parseInt(e.target.value))}
                className="w-full rounded-lg border-stone-300 px-3 py-2 border"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Special requests</label>
              <textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                rows={3}
                className="w-full rounded-lg border-stone-300 px-3 py-2 border"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-stone-900 text-white py-3 rounded-lg font-medium hover:bg-stone-800 transition disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <BookingContent />
    </Suspense>
  );
}
