import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages deploys via @cloudflare/next-on-pages (edge runtime).
  // Do NOT use output: "standalone" — it is incompatible with the Pages adapter.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Force dynamic rendering for API routes (they use Firestore + NextAuth).
  experimental: {
    // Allow large server bundles for the Cloudflare Workers 3MB limit
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
