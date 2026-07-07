import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@core"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
