"use client";

import { useEffect, useState } from "react";

/** True while the page is being scrolled *down* somewhere below the top.
 *
 * Chrome that floats over the content - the bottom nav capsule, the kecárna
 * bubble - uses this to get out of the way while you are reading and come
 * back the moment you reach upwards, which is what "I want the controls"
 * looks like. Shared rather than reimplemented per component: two copies
 * with their own thresholds drift apart, and then the bubble and the bar
 * disappear at visibly different moments.
 *
 * The 6px floor is what keeps it from twitching - sub-pixel scroll noise and
 * iOS rubber-banding both report tiny deltas, and `last` deliberately does
 * not move until one is exceeded, so slow drags still accumulate into a real
 * direction. Near the top it always reports false: nothing up there needs the
 * room. */
export function useScrolledDown(): boolean {
  const [down, setDown] = useState(false);

  useEffect(() => {
    let frame = 0;
    let last = window.scrollY;
    const read = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - last;
      if (Math.abs(delta) < 6) return;
      last = y;
      setDown(y > 96 && delta > 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return down;
}
