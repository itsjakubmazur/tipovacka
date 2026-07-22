"use client";

import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";

/** Floating helper shown while the card is still open: one tap scrolls
 * to the first fight without a saved tip. Stays in sync as tips are
 * saved/cleared via the "tip-state-changed" events FightTipCard fires. */
export function JumpToUntipped({
  fightIds,
  initialUntipped,
}: {
  fightIds: string[];
  initialUntipped: string[];
}) {
  const [untipped, setUntipped] = useState(() => new Set(initialUntipped));

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

  const firstUntipped = fightIds.find((id) => untipped.has(id));
  if (!firstUntipped) return null;

  return (
    <button
      type="button"
      onClick={() =>
        document.getElementById(`fight-${firstUntipped}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      className="fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-black/30 outline-none transition-transform hover:bg-[#e6bf00] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-95 md:bottom-6"
    >
      <ArrowDown className="size-4" />
      Netipnuto: {untipped.size}
    </button>
  );
}
