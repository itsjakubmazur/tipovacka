"use client";

import { usePathname } from "next/navigation";

/** Fades and lifts the page content on every route change.
 *
 * Keyed by pathname, not by search params: switching galas on the leaderboard
 * or filtering a list stays put (those have their own, more specific motion),
 * while actually moving between sections reads as a move.
 *
 * The View Transitions API would be the fancier tool, but App Router
 * navigations resolve asynchronously and there's no reliable "the new page is
 * committed" signal to hand it - a keyed CSS animation lands the same effect
 * without ever leaving the page frozen mid-transition. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
