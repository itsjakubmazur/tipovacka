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
    <div className="sticky top-14 z-30 -mx-4 flex gap-2 overflow-x-auto border-b border-white/45 bg-background/80 px-4 py-2 backdrop-blur-lg dark:border-neutral-700/45">
      {segments.map((segment) => (
        <button
          key={segment.key}
          type="button"
          onClick={() =>
            document
              .getElementById(`segment-${segment.key}`)
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          className="shrink-0 rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-400 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}
