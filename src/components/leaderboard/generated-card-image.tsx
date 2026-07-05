"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Wrapper for the on-the-fly generated share PNGs (result card,
 * podium). Rendering them takes a couple of seconds server-side, so a
 * brand shimmer fills the reserved space until the image arrives -
 * otherwise the card area just sits blank and looks broken. */
export function GeneratedCardImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-xl border border-white/45 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:shadow-black/60">
      {!loaded && (
        // The placeholder backdrop is always near-black (matching the card
        // being generated), so pin the shimmer's base color to light - the
        // theme variable would make it black-on-black in light mode.
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-neutral-950 [--foreground:#ededed]">
          <span className="brand-loader whitespace-nowrap text-xl font-bold tracking-tight">
            OKTAGON GARÁŽ
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
            Generuji grafiku…
          </span>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={1200}
        height={630}
        onLoad={() => setLoaded(true)}
        className={cn("w-full transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
