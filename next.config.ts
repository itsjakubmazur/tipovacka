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
  // Next ships `sharp` as an optional dependency for its own image
  // optimizer, so output file tracing pulls it - and both the glibc and
  // musl libvips builds - into *every* server function: ~32 MB a piece,
  // on routes like /login and /pravidla that never touch an image. On
  // Vercel /_next/image is served by the platform's image optimization,
  // never from inside these functions, so none of it is ever loaded.
  // Excluding it takes each function from ~38.5 MB to ~5.5 MB.
  //
  // serverExternalPackages is the wrong knob here: sharp is already on
  // Next's default external list, and that only stops it being bundled -
  // the tracer still copies it in. Tracing is what has to be told.
  //
  // Self-hosting (`output: "standalone"`, Docker) would need sharp back,
  // since there the app's own optimizer does the resizing. `next start`
  // locally and in CI is unaffected - it resolves sharp from node_modules
  // rather than from the trace.
  outputFileTracingExcludes: {
    "/*": ["node_modules/@img/**", "node_modules/sharp/**"],
  },
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
