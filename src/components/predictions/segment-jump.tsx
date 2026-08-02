"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/ui/segmented-control";

/** how far under the app header a heading has to travel before that segment
 * counts as the one you're reading */
const BAND = 140;
/** the bar stays out of the way at the top of the page and drifts in as soon
 * as you actually start moving down the card */
const SHOW_AFTER = 160;
/** The app header is `h-14` plus the top safe-area inset, so on a notched
 * phone in standalone PWA mode it is ~110px tall, not 56. A bar parked at a
 * flat top-16 sat entirely behind it - which is exactly why these pills were
 * invisible on a phone and fine on a desktop, where the inset is 0. */
const BAR_TOP = "top-[calc(env(safe-area-inset-top)+4rem)]";

type Progress = { key: string | null; ratio: number };

/** Jump between the sections of the card (Hlavní karta / Prelims / Free
 * Prelims / Zrušené zápasy) and see where in them you are.
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
  const [progress, setProgress] = useState<Progress>({
    key: segments[0]?.key ?? null,
    ratio: 0,
  });
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
  // heading that has passed under the header is right at any offset - and it
  // gives us how far *into* that section we are for free.
  const segmentKeys = segments.map((segment) => segment.key).join(",");
  useEffect(() => {
    const keys = segmentKeys ? segmentKeys.split(",") : [];
    if (keys.length < 2) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const scrollY = window.scrollY;
      // scroll position at which each heading comes to rest under the header
      const stops = keys.map((key) => {
        const el = document.getElementById(`segment-${key}`);
        return {
          key,
          at: el ? scrollY + el.getBoundingClientRect().top - BAND : Number.POSITIVE_INFINITY,
        };
      });

      let index = 0;
      for (let i = 0; i < stops.length; i += 1) {
        if (scrollY >= stops[i].at) index = i;
      }
      const start = stops[index].at;
      const end =
        index + 1 < stops.length
          ? stops[index + 1].at
          : document.documentElement.scrollHeight - window.innerHeight;
      const span = end - start;
      const ratio = span > 0 ? Math.min(1, Math.max(0, (scrollY - start) / span)) : 0;

      setProgress((prev) =>
        prev.key === stops[index].key && Math.abs(prev.ratio - ratio) < 0.005
          ? prev
          : { key: stops[index].key, ratio }
      );
      if (floating) setVisible(scrollY > SHOW_AFTER);
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

  const bar = (
    <SegmentedControl
      segments={segments}
      value={progress.key}
      fill={progress.ratio}
      size="sm"
      ariaLabel="Sekce karty"
      onChange={(key) =>
        document.getElementById(`segment-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    />
  );

  if (floating) {
    // Through a portal on purpose: in the page it would be a child of
    // .stagger-in, whose children animate with a transform, and a transformed
    // ancestor makes position:fixed resolve against *it* rather than the
    // viewport.
    if (!mounted) return null;
    return createPortal(
      <div
        className={cn(
          // the outer layer never catches taps, so the bar can hover over the
          // cards without stealing the ones aimed at a fighter
          "pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4",
          BAR_TOP,
          className
        )}
      >
        <div
          className={cn(
            "glass-floating max-w-full rounded-full p-1 transition-all duration-300 ease-out motion-reduce:transition-none",
            visible
              ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
              : "-translate-y-3 scale-95 opacity-0"
          )}
        >
          {bar}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className={cn("sticky z-30 -mx-4 px-4 py-1", BAR_TOP, className)}>
      {/* the same glass capsule as the floating shape - it sticks over the
          cards as you scroll, so it needs a backdrop of its own */}
      <div className="glass-floating inline-block max-w-full rounded-full p-1">
        {bar}
      </div>
    </div>
  );
}
