import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@core"],
  turbopack: {
    root: process.cwd(),
  },
  // Phase 1 is a fixture-only UI template: no remote image hosts are reachable
  // and no production data is fetched. Kimi adds remotePatterns in Phase 2
  // alongside the real Space/experience media provider.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
