"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { GLASS_PILL } from "@/lib/pills";

/** Jump between card segments (Hlavní karta / Prelims / Free Prelims), and -
 * because it highlights the one you're reading - double as their heading,
 * which is why the fight list no longer prints "Hlavní karta" above its first
 * group.
 *
 * Two shapes. In flow (desktop) it's a sticky row above the columns. Floating
 * (mobile) it costs no layout at all: it drifts in over the cards once you're
 * actually in the fight list and drifts back out at the end of it, so the top
 * of the page doesn't reserve a strip for something you only want mid-scroll. */
export function SegmentJump({
  segments,
  className,
  floating = false,
  watchId,
}: {
  segments: { key: string; label: string }[];
  className?: string;
  /** float over the content instead of taking a row of its own */
  floating?: boolean;
  /** id of the element the floating bar shadows - it shows only while that
   * element is on screen */
  watchId?: string;
}) {
  const [active, setActive] = useState<string | null>(segments[0]?.key ?? null);
  const [visible, setVisible] = useState(!floating);

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
      // a band just under the app header: whichever segment crosses it is the
      // one you're actually looking at
      { rootMargin: "-120px 0px -70% 0px" }
    );
    anchors.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [segments]);

  useEffect(() => {
    if (!floating || !watchId) return;
    const target = document.getElementById(watchId);
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      // ignore the strip under the app header, and let it go early rather than
      // hang around over the last card
      rootMargin: "-72px 0px -25% 0px",
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [floating, watchId]);

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
    return (
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
            "flex max-w-full gap-1.5 overflow-x-auto rounded-full border border-white/50 bg-background/80 p-1 shadow-lg shadow-black/25 backdrop-blur-xl transition-all duration-300 ease-out motion-reduce:transition-none dark:border-neutral-700/60",
            visible ? "pointer-events-auto translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
          )}
        >
          {pills}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("sticky top-16 z-30 -mx-4 flex gap-2 overflow-x-auto px-4 py-1", className)}>
      {pills}
    </div>
  );
}
