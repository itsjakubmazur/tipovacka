"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Reports whether a CSS media query currently matches.
 *
 * Server-rendered HTML has no viewport, so the server snapshot is always
 * `false` - components using this must render their small-screen variant
 * first and upgrade on mount, otherwise hydration mismatches. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
