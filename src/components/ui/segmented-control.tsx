"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type Segment = {
  key: string;
  label: React.ReactNode;
  /** announced to screen readers when the visible label is an icon or a
   * shortened word */
  title?: string;
  /** When the choice is a route rather than local state - the leaderboard's
   * three views are pages - the segment renders as a Link, so it keeps
   * prefetching, middle-click and the back button. */
  href?: string;
};

/** A row of segments with one piece of glass sliding between them.
 *
 * The thumb is a single element that moves rather than a colour swapped onto
 * whichever segment is active: you see the selection travel, and the glass
 * catches the page underneath as it goes. It started life inside the fight
 * card's section jumper; everything in the app that is "pick one of these
 * two or three" now shares it instead of re-inventing an active-pill style.
 */
export function SegmentedControl({
  segments,
  value,
  onChange,
  fill,
  size = "md",
  className,
  ariaLabel,
}: {
  segments: Segment[];
  value: string | null;
  /** not needed when every segment carries an href */
  onChange?: (key: string) => void;
  /** 0-1, drawn inside the thumb - used by the fight card to show how far
   * through a section you have scrolled. Left out, the thumb is plain. */
  fill?: number;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const segmentRefs = useRef(new Map<string, HTMLElement>());
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  const place = useCallback(() => {
    const el = value ? segmentRefs.current.get(value) : null;
    const scroller = scrollRef.current;
    if (!el || !scroller) return;
    setThumb((prev) =>
      prev && prev.left === el.offsetLeft && prev.width === el.offsetWidth
        ? prev
        : { left: el.offsetLeft, width: el.offsetWidth }
    );
    // keep the active segment in view when the row is wider than the screen
    const overflowLeft = el.offsetLeft - scroller.scrollLeft;
    const overflowRight = overflowLeft + el.offsetWidth - scroller.clientWidth;
    if (overflowLeft < 0) scroller.scrollBy({ left: overflowLeft - 8, behavior: "smooth" });
    else if (overflowRight > 0) scroller.scrollBy({ left: overflowRight + 8, behavior: "smooth" });
  }, [value]);

  useEffect(() => {
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [place]);

  return (
    <div
      ref={scrollRef}
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "relative flex gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {thumb && (
        <div
          aria-hidden
          className="glass-thumb pointer-events-none absolute inset-y-0 overflow-hidden rounded-full transition-[transform,width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: thumb.width, transform: `translateX(${thumb.left}px)` }}
        >
          {fill != null && (
            <div
              className="h-full rounded-full bg-black/[0.06] transition-[width] duration-150 ease-linear motion-reduce:transition-none dark:bg-white/15"
              style={{ width: `${Math.round(fill * 100)}%` }}
            />
          )}
        </div>
      )}

      {segments.map((segment) => {
        const active = segment.key === value;
        const ref = (el: HTMLElement | null) => {
          if (el) segmentRefs.current.set(segment.key, el);
          else segmentRefs.current.delete(segment.key);
        };
        // Not role="tab": a tablist promises tabpanels, and these switch a
        // route or a form mode, not panels. A link that is the page you are on
        // says aria-current; a button that is stuck on says aria-pressed.
        const shared = {
          title: segment.title,
          className: cn(
            "relative z-10 flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold outline-none transition-[color,transform] duration-300 ease-out active:scale-95 focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none",
            size === "sm" ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
            // the thumb is light glass, not a black fill - white type on it
            // would be invisible
            active
              ? "text-neutral-900 dark:text-white"
              : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
          ),
          children: segment.label,
        };

        return segment.href ? (
          <Link
            key={segment.key}
            ref={ref}
            href={segment.href}
            aria-current={active ? "page" : undefined}
            {...shared}
          />
        ) : (
          <button
            key={segment.key}
            ref={ref}
            type="button"
            aria-pressed={active}
            onClick={() => onChange?.(segment.key)}
            {...shared}
          />
        );
      })}
    </div>
  );
}
