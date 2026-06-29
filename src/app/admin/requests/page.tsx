"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface BookingRow {
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

export default function AdminRequestsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchBookings() {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/bookings?status=requested");
        if (!res.ok) throw new Error("Failed to fetch bookings");
        const data = await res.json();
        if (!cancelled) {
          setBookings(data.bookings || []);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error loading bookings");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchBookings();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAction(id: string, action: "approve" | "reject") {
    setActionId(id);
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: id, action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to ${action} booking`);
      }
      // Refresh list after action
      const refreshRes = await fetch("/api/admin/bookings?status=requested");
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setBookings(refreshData.bookings || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Error during ${action}`);
    } finally {
      setActionId(null);
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const formatCurrency = (cents: number, currency: string) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "EUR",
    }).format(cents / 100);

  const nights = (checkIn: string, checkOut: string) => {
    const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Booking Requests
          </h1>
          <nav className="flex gap-3">
            <Link
              href="/admin/dashboard"
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Overview
            </Link>
            <Link
              href="/admin/requests"
              className="px-3 py-2 rounded-md text-sm font-medium bg-gray-900 text-white"
            >
              Requests
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading requests…</div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No pending booking requests.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700">Lead</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Room</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Dates</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Guests</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Total</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {b.leads
                          ? `${b.leads.first_name} ${b.leads.last_name}`
                          : "—"}
                      </div>
                      <div className="text-xs text-gray-400">
                        {b.leads?.email || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {b.rooms?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{formatDate(b.check_in)} – {formatDate(b.check_out)}</div>
                      <div className="text-xs text-gray-400">
                        {nights(b.check_in, b.check_out)} night
                        {nights(b.check_in, b.check_out) > 1 ? "s" : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{b.guests}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatCurrency(b.total_price, b.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => handleAction(b.id, "approve")}
                          disabled={actionId === b.id}
                          className="px-3 py-1.5 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {actionId === b.id ? "…" : "Approve"}
                        </button>
                        <button
                          onClick={() => handleAction(b.id, "reject")}
                          disabled={actionId === b.id}
                          className="px-3 py-1.5 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {actionId === b.id ? "…" : "Reject"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
