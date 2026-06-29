import Link from "next/link";
import { config } from "@/lib/config";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-stone-900">{config.brandName}</h1>
          <nav className="space-x-4 text-sm">
            <Link href="/login" className="text-stone-600 hover:text-stone-900">
              Log in
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-stone-900 text-white font-medium hover:bg-stone-800 transition"
            >
              Apply to stay
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm font-medium text-stone-500 uppercase tracking-widest mb-4">
          {config.brandTagline}
        </p>
        <h2 className="text-4xl sm:text-5xl font-light text-stone-900 max-w-2xl leading-tight mb-6">
          Welcome to {config.villaName}
        </h2>
        <p className="text-lg text-stone-600 max-w-xl mb-10">
          {config.villaDescription}
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-stone-900 text-white font-medium hover:bg-stone-800 transition"
          >
            Request an invitation
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-stone-300 text-stone-700 font-medium hover:bg-white transition"
          >
            Lead log in
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left max-w-3xl">
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
            <h3 className="font-medium text-stone-900 mb-2">Apply</h3>
            <p className="text-sm text-stone-500">
              Share a few details about your group and preferred dates.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
            <h3 className="font-medium text-stone-900 mb-2">Get approved</h3>
            <p className="text-sm text-stone-500">
              Don reviews every request and confirms availability.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
            <h3 className="font-medium text-stone-900 mb-2">Book your room</h3>
            <p className="text-sm text-stone-500">
              Choose your room, submit your booking, and receive next steps.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 py-6">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-stone-400">
          {config.villaLocation} · Questions?{" "}
          <a href={`mailto:${config.supportEmail}`} className="underline hover:text-stone-600">
            {config.supportEmail}
          </a>
        </div>
      </footer>
    </div>
  );
}
