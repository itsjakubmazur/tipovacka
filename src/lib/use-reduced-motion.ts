"use client";

import { useCallback, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** Whether the viewer has asked for less movement.
 *
 * Read through useSyncExternalStore rather than an effect, so the first
 * client render already knows the answer - a count-up or a ring that starts
 * animating and only then discovers it shouldn't have is worse than not
 * animating at all. Server-rendered as false, which matches the CSS default. */
export function usePrefersReducedMotion(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const media = window.matchMedia(QUERY);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}
