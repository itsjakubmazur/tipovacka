"use client";

import { cn } from "@/lib/utils";
import { GLASS_PILL } from "@/lib/pills";

/** Sticky chip row under the app header: one tap scrolls to the start
 * of a card segment (Hlavní karta / Prelims / Free Prelims). Only
 * rendered when the card actually has more than one segment. */
export function SegmentJump({
  segments,
}: {
  segments: { key: string; label: string }[];
}) {
  if (segments.length < 2) return null;

  return (
    // Floating glass pills - no full-width band behind them, each chip is
    // opaque enough on its own to stay readable over scrolling cards.
    <div className="sticky top-16 z-30 -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
      {segments.map((segment) => (
        <button
          key={segment.key}
          type="button"
          onClick={() =>
            document
              .getElementById(`segment-${segment.key}`)
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          className={cn(GLASS_PILL, "shrink-0 px-3.5 py-1.5 text-xs font-semibold")}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}
