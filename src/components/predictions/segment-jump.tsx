"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { GLASS_PILL } from "@/lib/pills";

/** how far under the app header a heading has to travel before that segment
 * counts as the one you're reading */
const BAND = 140;
/** the bar stays out of the way at the top of the page and drifts in as soon
 * as you actually start moving down the card */
const SHOW_AFTER = 160;

/** Jump between the sections of the card (Hlavní karta / Prelims / Free
 * Prelims / Zrušené zápasy) and see which one you're in.
 *
 * Two shapes. In flow (desktop) it's a sticky row above the columns. Floating
 * (mobile) it costs no layout at all: it drifts in over the cards once you
 * start scrolling and drifts back out at the top of the page. Either way the
 * sections still print their own headings - the bar tells you where you are,
 * it doesn't replace the label. */
export function SegmentJump({
  segments,
  className,
  floating = false,
}: {
  segments: { key: string; label: string }[];
  className?: string;
  /** float over the content instead of taking a row of its own */
  floating?: boolean;
}) {
  const [active, setActive] = useState<string | null>(segments[0]?.key ?? null);
  const [visible, setVisible] = useState(!floating);
  // false while rendering on the server and through hydration, true after -
  // there's no document to portal into until then
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Measured off scroll rather than an IntersectionObserver: an observer only
  // fires while an anchor crosses its band, so the highlight went stale in the
  // long stretch between two headings and on the way back up. Reading the last
  // heading that has passed under the header is right at any offset.
  const segmentKeys = segments.map((segment) => segment.key).join(",");
  useEffect(() => {
    const keys = segmentKeys ? segmentKeys.split(",") : [];
    if (keys.length < 2) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      let current = keys[0];
      for (const key of keys) {
        const el = document.getElementById(`segment-${key}`);
        if (el && el.getBoundingClientRect().top <= BAND) current = key;
      }
      setActive(current);
      if (floating) setVisible(window.scrollY > SHOW_AFTER);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [segmentKeys, floating]);

  if (segments.length < 2) return null;

  const pills = segments.map((segment) => (
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
  ));

  if (floating) {
    // Through a portal on purpose. In the page it would be a child of
    // .stagger-in - which animates its children with a transform, and a
    // transformed ancestor makes position:fixed resolve against *it* rather
    // than the viewport, which is why the bar never showed up where it should.
    if (!mounted) return null;
    return createPortal(
      <div
        className={cn(
          // the outer layer never catches taps, so the bar can hover over the
          // cards without stealing the ones aimed at a fighter
          "pointer-events-none fixed inset-x-0 top-16 z-30 flex justify-center px-4",
          className
        )}
      >
        <div
          className={cn(
            "flex max-w-full gap-1.5 overflow-x-auto rounded-full border border-black/10 bg-background/85 p-1 shadow-lg shadow-black/20 backdrop-blur-xl transition-all duration-300 ease-out motion-reduce:transition-none dark:border-white/15",
            visible ? "pointer-events-auto translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
          )}
        >
          {pills}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className={cn("sticky top-16 z-30 -mx-4 flex gap-2 overflow-x-auto px-4 py-1", className)}>
      {pills}
    </div>
  );
}
