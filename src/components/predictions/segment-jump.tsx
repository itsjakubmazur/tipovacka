"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { GLASS_PILL } from "@/lib/pills";

/** Sticky chip row under the app header: one tap scrolls to the start
 * of a card segment (Hlavní karta / Prelims / Free Prelims). Only
 * rendered when the card actually has more than one segment. */
export function SegmentJump({
  segments,
  className,
}: {
  segments: { key: string; label: string }[];
  /** Rendered in two places (see the event detail): above the columns on
   * desktop, under the status card on a phone. Must not be wrapped in a plain
   * div to hide it - the row is sticky, and a wrapper with no height of its
   * own leaves it nowhere to stick. */
  className?: string;
}) {
  // Which segment you're currently reading. With this the row stops being
  // just navigation and starts being the heading too - which is why the list
  // no longer repeats "Hlavní karta" as its first title.
  const [active, setActive] = useState<string | null>(segments[0]?.key ?? null);

  useEffect(() => {
    const anchors = segments
      .map((segment) => document.getElementById(`segment-${segment.key}`))
      .filter((el): el is HTMLElement => el !== null);
    if (anchors.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id.replace("segment-", ""));
        }
      },
      // a band just under the sticky row: the segment crossing it is the one
      // you're actually looking at
      { rootMargin: "-120px 0px -70% 0px" }
    );
    anchors.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [segments]);

  if (segments.length < 2) return null;

  return (
    // Floating glass pills - no full-width band behind them, each chip is
    // opaque enough on its own to stay readable over scrolling cards.
    <div className={cn("sticky top-16 z-30 -mx-4 flex gap-2 overflow-x-auto px-4 py-1", className)}>
      {segments.map((segment) => (
        <button
          key={segment.key}
          type="button"
          onClick={() =>
            document
              .getElementById(`segment-${segment.key}`)
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          className={cn(
            "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
            segment.key === active
              ? "border border-neutral-800 bg-neutral-900 text-white dark:border-white/25 dark:bg-white/15 dark:text-white"
              : GLASS_PILL
          )}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}
