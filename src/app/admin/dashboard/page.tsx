"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  pendingRequests: number;
  totalBookings: number;
  revenue: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) throw new Error("Failed to fetch stats");
        const data = await res.json();
        setStats(data);
      } catch (err: any) {
        setError(err.message || "Error loading stats");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Operator Dashboard
          </h1>
          <nav className="flex gap-3">
            <Link
              href="/admin/dashboard"
              className="px-3 py-2 rounded-md text-sm font-medium bg-gray-900 text-white"
            >
              Overview
            </Link>
            <Link
              href="/admin/requests"
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Requests
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="text-center py-12 text-gray-500">Loading stats…</div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
            {error}
          </div>
        )}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {/* Pending Requests */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Pending Requests
              </div>
              <div className="mt-2 text-3xl font-bold text-gray-900">
                {stats.pendingRequests}
              </div>
              <div className="mt-1 text-sm text-gray-400">
                Awaiting approval
              </div>
            </div>

            {/* Total Bookings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Total Bookings
              </div>
              <div className="mt-2 text-3xl font-bold text-gray-900">
                {stats.totalBookings}
              </div>
              <div className="mt-1 text-sm text-gray-400">
                All active reservations
              </div>
            </div>

            {/* Revenue */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Revenue
              </div>
              <div className="mt-2 text-3xl font-bold text-gray-900">
                {formatCurrency(stats.revenue)}
              </div>
              <div className="mt-1 text-sm text-gray-400">
                From approved bookings
              </div>
            </div>
          </div>
        )}

        {/* Quick action */}
        <div className="mt-8">
          <Link
            href="/admin/requests"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition"
          >
            Review pending requests →
          </Link>
        </div>
      </main>
    </div>
  );
}
