"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Slides its content in from whichever side you came from.
 *
 * `index` is the item's position in the list you're navigating (galas, newest
 * first). Picking an older gala means moving right through the list, so the
 * new board enters from the right; picking a newer one enters from the left.
 *
 * The direction is derived during render rather than in an effect, so the
 * animation class is on the element the very first time it paints - set it
 * afterwards and the first frame has already been committed without it.
 * Arriving on the page never animates sideways; only a change does. */
export function SlideOnChange({
  index,
  children,
  className,
}: {
  index: number;
  children: React.ReactNode;
  className?: string;
}) {
  const [seen, setSeen] = useState<{ index: number; direction: "left" | "right" | null }>({
    index,
    direction: null,
  });

  if (seen.index !== index) {
    setSeen({ index, direction: index > seen.index ? "right" : "left" });
  }

  return (
    <div
      // restarts the CSS animation on every change - without a fresh element
      // the browser reuses the finished animation and nothing moves next time
      key={index}
      className={cn(
        seen.direction === "right" && "animate-board-in-right",
        seen.direction === "left" && "animate-board-in-left",
        className
      )}
    >
      {children}
    </div>
  );
}
