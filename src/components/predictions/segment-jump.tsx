"use client";

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
          className="shrink-0 rounded-full border border-white/60 bg-white/85 px-3.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-lg shadow-black/15 backdrop-blur-lg transition-colors hover:border-neutral-400 dark:border-neutral-600/60 dark:bg-neutral-800/90 dark:text-neutral-200 dark:shadow-black/40 dark:hover:border-neutral-400"
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}
