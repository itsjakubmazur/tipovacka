"use client";

import { useEffect, useState } from "react";

/** How many pixels the on-screen keyboard currently covers at the bottom of
 * the window.
 *
 * iOS Safari does not resize the layout viewport when the keyboard opens - it
 * just draws over it, so `position: fixed` bottom sheets end up hidden behind
 * the keys. The visual viewport does shrink, so the difference between the two
 * is the keyboard's height; feeding that back in as padding lets a sheet sit
 * on top of the keyboard and push its content up, the way messengers do.
 *
 * Returns 0 when nothing is covering the viewport (or the API is missing). */
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active) return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      // offsetTop matters because Safari also scrolls the visual viewport up
      // to reveal the focused field.
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      // Ignore a few stray pixels from rounding / browser chrome.
      setInset(covered > 24 ? Math.round(covered) : 0);
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [active]);

  // Gated rather than reset in the effect, so a closed sheet always reports 0
  // without an extra state write.
  return active ? inset : 0;
}
