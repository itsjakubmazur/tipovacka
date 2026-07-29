"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/** FLIP animation for a reordering list.
 *
 * Deliberately silent on the first paint. Someone who only opens the
 * leaderboard once an evening would otherwise be met by every row flying
 * about for no reason - there's nothing to "show movement from". The places
 * it does fire are the ones where it reads as movement: the board reshuffling
 * under you as results land, the "since your last visit" catch-up, and the
 * end-of-gala replay.
 *
 * A plain slide was too easy to miss, so a row that moves is picked up -
 * it lifts, casts a shadow, travels *above* its neighbours and settles with a
 * touch of overshoot. Gaining places also glows in the accent, so overtaking
 * someone is legible rather than merely visible.
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

        // shift > 0 means the row ended up higher on the board than it was
        const climbed = shift > 0;
        const distance = Math.abs(shift);
        const duration = Math.min(1200, 700 + distance);

        // Travel over the neighbours rather than through them.
        const previousZ = el.style.zIndex;
        const previousPosition = el.style.position;
        el.style.position = "relative";
        el.style.zIndex = "20";

        const lift = climbed
          ? "drop-shadow(0 12px 18px rgba(0,0,0,0.38)) drop-shadow(0 0 12px rgba(255,212,0,0.55))"
          : "drop-shadow(0 12px 18px rgba(0,0,0,0.38))";

        const animation = el.animate(
          [
            { transform: `translateY(${shift}px) scale(1)`, filter: "none" },
            {
              // hangs a little past halfway, which is what makes it read as
              // being carried rather than sliding
              transform: `translateY(${shift * 0.32}px) scale(1.04)`,
              filter: lift,
              offset: 0.5,
            },
            { transform: "translateY(0) scale(1)", filter: "none" },
          ],
          { duration, easing: "cubic-bezier(0.34, 0.9, 0.24, 1.02)" }
        );

        animation.finished
          .catch(() => {})
          .finally(() => {
            el.style.zIndex = previousZ;
            el.style.position = previousPosition;
          });
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
