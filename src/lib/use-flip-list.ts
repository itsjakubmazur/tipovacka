"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/** FLIP animation for a reordering list.
 *
 * Deliberately silent on the first paint. Someone who only opens the
 * leaderboard once an evening would otherwise be met by every row flying
 * about for no reason - there's nothing to "show movement from", and the
 * arrows next to each name already say what changed since the last gala.
 * The animation is for the case it actually reads as movement: the board
 * reshuffling under you while you're watching it (the page refreshes live on
 * new predictions), so a row that overtakes another visibly slides past it.
 *
 * Usage: `const rowRef = useFlipList(keysInOrder)` then `ref={rowRef(key)}`.
 */
export function useFlipList(keys: string[]) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const positions = useRef(new Map<string, number>());
  const firstPaint = useRef(true);
  const signature = keys.join("|");

  useLayoutEffect(() => {
    const next = new Map<string, number>();
    nodes.current.forEach((el, key) => next.set(key, el.getBoundingClientRect().top));

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!firstPaint.current && !reduceMotion) {
      nodes.current.forEach((el, key) => {
        const before = positions.current.get(key);
        const after = next.get(key);
        if (before == null || after == null) return;
        const shift = before - after;
        if (Math.abs(shift) < 1) return;
        // Invert to where the row used to be, then play it back to its new
        // place. Rows that moved further take marginally longer, which reads
        // as weight rather than a uniform slide.
        el.animate(
          [{ transform: `translateY(${shift}px)` }, { transform: "translateY(0)" }],
          {
            duration: Math.min(700, 380 + Math.abs(shift) * 0.6),
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          }
        );
      });
    }

    firstPaint.current = false;
    positions.current = next;
  }, [signature]);

  return useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) nodes.current.set(key, el);
      else nodes.current.delete(key);
    },
    []
  );
}
