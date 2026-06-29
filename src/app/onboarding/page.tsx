"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { config } from "@/lib/config";

interface OnboardingForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp: string;
  dietaryRestrictions: string;
  preferredDates: string;
  roomPreference: string;
  guests: string;
}

interface OnboardingResult {
  success?: boolean;
  error?: string;
  message?: string;
  portalLink?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [form, setForm] = useState<OnboardingForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    whatsapp: "",
    dietaryRestrictions: "",
    preferredDates: "",
    roomPreference: "",
    guests: "1",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = (await res.json()) as OnboardingResult;

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setResult(data);
      setSuccess(data.message || "Application submitted successfully!");
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        whatsapp: "",
        dietaryRestrictions: "",
        preferredDates: "",
        roomPreference: "",
        guests: "1",
      });

      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

  const labelClass = "mb-1.5 block text-sm font-medium text-zinc-700";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            {config.brandName}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">{config.brandTagline}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-1 text-xl font-semibold text-zinc-900">Apply to stay</h2>
          <p className="mb-6 text-sm text-zinc-500">
            Tell us a little about yourself and your trip.
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <p>{success}</p>
              {result?.portalLink && (
                <p className="mt-2 break-all text-xs">
                  Dev/test login link: {result.portalLink}
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className={labelClass}>
                  First name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={form.firstName}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Jane"
                />
              </div>
              <div>
                <label htmlFor="lastName" className={labelClass}>
                  Last name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={form.lastName}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Doe"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className={labelClass}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                className={inputClass}
                placeholder="jane@example.com"
              />
            </div>

            {/* Phone & WhatsApp */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="phone" className={labelClass}>
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="+1 555 000 0000"
                />
              </div>
              <div>
                <label htmlFor="whatsapp" className={labelClass}>
                  WhatsApp
                </label>
                <input
                  id="whatsapp"
                  name="whatsapp"
                  type="tel"
                  value={form.whatsapp}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="+1 555 000 0000"
                />
              </div>
            </div>

            {/* Preferred dates */}
            <div>
              <label htmlFor="preferredDates" className={labelClass}>
                Preferred dates
              </label>
              <input
                id="preferredDates"
                name="preferredDates"
                type="text"
                value={form.preferredDates}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. July 15 – July 22, 2026"
              />
            </div>

            {/* Room preference & Guests */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="roomPreference" className={labelClass}>
                  Room preference
                </label>
                <select
                  id="roomPreference"
                  name="roomPreference"
                  value={form.roomPreference}
                  onChange={handleChange}
                  className={`${inputClass} appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3d%22http%3a%2f%2fwww.w3.org%2f2000%2fsvg%22%20viewBox%3d%220%200%2020%2020%22%20fill%3d%22%236b7280%22%3e%3cpath%20fill-rule%3d%22evenodd%22%20d%3d%22M5.293%207.293a1%201%200%20011.414%200L10%2010.586l3.293-3.293a1%201%200%20111.414%201.414l-4%204a1%201%200%2001-1.414%200l-4-4a1%201%200%20010-1.414z%22%20clip-rule%3d%22evenodd%22%2f%3e%3c%2fsvg%3e')] bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10`}
                >
                  <option value="">No preference</option>
                  <option value="master">Master suite</option>
                  <option value="double">Double room</option>
                  <option value="single">Single room</option>
                </select>
              </div>
              <div>
                <label htmlFor="guests" className={labelClass}>
                  Number of guests
                </label>
                <select
                  id="guests"
                  name="guests"
                  value={form.guests}
                  onChange={handleChange}
                  className={`${inputClass} appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3d%22http%3a%2f%2fwww.w3.org%2f2000%2fsvg%22%20viewBox%3d%220%200%2020%2020%22%20fill%3d%22%236b7280%22%3e%3cpath%20fill-rule%3d%22evenodd%22%20d%3d%22M5.293%207.293a1%201%200%20011.414%200L10%2010.586l3.293-3.293a1%201%200%20111.414%201.414l-4%204a1%201%200%2001-1.414%200l-4-4a1%201%200%20010-1.414z%22%20clip-rule%3d%22evenodd%22%2f%3e%3c%2fsvg%3e')] bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10`}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "guest" : "guests"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dietary restrictions */}
            <div>
              <label htmlFor="dietaryRestrictions" className={labelClass}>
                Dietary restrictions / allergies
              </label>
              <textarea
                id="dietaryRestrictions"
                name="dietaryRestrictions"
                rows={3}
                value={form.dietaryRestrictions}
                onChange={handleChange}
                className={`${inputClass} resize-none`}
                placeholder="Vegetarian, gluten-free, nut allergy, etc."
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit application"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="underline hover:text-zinc-600">
            Log in
          </Link>
          {" · "}Questions? Reach us at{" "}
          <a href={`mailto:${config.supportEmail}`} className="underline hover:text-zinc-600">
            {config.supportEmail}
          </a>
        </p>
      </div>
    </div>
  );
}
