"use client";

import { cn } from "@/lib/utils";

/** The app's one way of opening and closing content.
 *
 * Animating to `height: auto` isn't possible, and measuring the content with
 * JS breaks the moment anything inside reflows (a photo loads, a bio wraps
 * differently). The grid trick avoids both: a single-row grid animated from
 * `0fr` to `1fr` resolves to the child's real height at every frame, so the
 * content can be any size and the transition still lands exactly.
 *
 * Deliberately unhurried - 500ms with a soft ease-out - because these
 * expansions are the app's most-seen bit of motion and a snappy 150ms reads
 * as a jump cut. */
export function Reveal({
  open,
  children,
  className,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-500 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className
      )}
      aria-hidden={!open}
    >
      {/* the clipper - the grid row shrinks around it, this hides the overflow */}
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
