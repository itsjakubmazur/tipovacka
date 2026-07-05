import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Version-skew protection: a tab opened on an older deployment would
  // otherwise fail client-side navigations against a newer one with
  // Next's "This page couldn't load" screen. With a deploymentId set,
  // the client detects the mismatch and does a full reload by itself.
  // VERCEL_DEPLOYMENT_ID is unique per deployment - the commit SHA
  // isn't, since main and the working branch usually point at the same
  // commit and Vercel builds both, rejecting the duplicate id. Sliced
  // because Vercel caps user-configured deploymentId at 32 chars.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID?.slice(0, 32),
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
