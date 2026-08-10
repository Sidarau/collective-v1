import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@core"],
  turbopack: {
    root: process.cwd(),
  },
  // Avatar images live in Supabase Storage (member portal profile uploads →
  // media bucket public URLs), so next/image must allow the host. Convention
  // matches the root app's next.config.ts (`*.supabase.co`); the concrete
  // project host is https://evviegqieqdmlxixwwxt.supabase.co
  // (DEFAULT_SUPABASE_URL in vendor-core/supabase.ts and packages/core).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;
