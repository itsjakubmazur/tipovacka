"use client";

import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";

/** Floating helper shown while the card is still open: one tap scrolls
 * to the first fight without a saved tip. Stays in sync as tips are
 * saved/cleared via the "tip-state-changed" events FightTipCard fires.
 *
 * On mobile, TipActionBar's own "Dotipovat (N)" button does the exact same
 * thing from inside the status hero at the top of the page - two CTAs for
 * one action is chrome the small screen doesn't have room for. This pill
 * only shows up once that button has scrolled out of view; on desktop,
 * where the hero often isn't in the same column as the fight list, it's
 * always available. */
export function JumpToUntipped({
  fightIds,
  initialUntipped,
}: {
  fightIds: string[];
  initialUntipped: string[];
}) {
  const [untipped, setUntipped] = useState(() => new Set(initialUntipped));
  const [suppressForActionBar, setSuppressForActionBar] = useState(false);

  useEffect(() => {
    function onChange(e: Event) {
      const { fightId, tipped } = (e as CustomEvent<{ fightId: string; tipped: boolean }>).detail;
      setUntipped((prev) => {
        const next = new Set(prev);
        if (tipped) next.delete(fightId);
        else next.add(fightId);
        return next;
      });
    }
    window.addEventListener("tip-state-changed", onChange);
    return () => window.removeEventListener("tip-state-changed", onChange);
  }, []);

  useEffect(() => {
    const cta = document.getElementById("tip-action-bar-cta");
    const isMobile = window.matchMedia("(max-width: 767px)");
    if (!cta || !isMobile.matches) return;

    const observer = new IntersectionObserver(([entry]) => setSuppressForActionBar(entry.isIntersecting), {
      rootMargin: "0px",
    });
    observer.observe(cta);
    return () => observer.disconnect();
  }, []);

  const firstUntipped = fightIds.find((id) => untipped.has(id));
  if (!firstUntipped || suppressForActionBar) return null;

  return (
    <button
      type="button"
      onClick={() =>
        document.getElementById(`fight-${firstUntipped}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      className="glass-accent fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-95 md:bottom-6"
    >
      <ArrowDown className="size-4" />
      Netipnuto: {untipped.size}
    </button>
  );
}
