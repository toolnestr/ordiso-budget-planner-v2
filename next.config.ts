import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — deploys as a static site on Cloudflare Pages (no Workers).
  // The app talks to Firebase Auth + Firestore directly from the browser.
  output: "export",
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
