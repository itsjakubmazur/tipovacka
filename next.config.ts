import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Version-skew protection: a tab opened on an older deployment would
  // otherwise fail client-side navigations against a newer one with
  // Next's "This page couldn't load" screen. With a deploymentId set,
  // the client detects the mismatch and does a full reload by itself.
  // On Vercel the commit SHA uniquely identifies the deployment
  // (truncated - Vercel caps deploymentId at 32 characters).
  deploymentId: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.sherdog.com",
      },
      {
        protocol: "https",
        hostname: "flagcdn.com",
      },
      {
        protocol: "https",
        hostname: "assets.oktagonmma.com",
      },
    ],
  },
};

export default nextConfig;
