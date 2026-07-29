"use client";

import { useEffect, useState } from "react";
import { ArrowDown, Star } from "lucide-react";

/** The tipping call-to-action inside the status hero: a progress bar and
 * two clearly-labelled paths. The primary button scrolls down to the
 * first untipped fight card (where the full fighter detail lives) so
 * nobody mistakes the quick shortcut for the only way to tip; the
 * secondary shortcut (passed in as children - the FastTipOverlay
 * trigger) opens the swipe carousel. Untipped count stays live via the
 * same "tip-state-changed" events FightTipCard fires. */
export function TipActionBar({
  tippableFightIds,
  initialUntipped,
  fotnAvailable,
  initialFotnPicked,
  children,
}: {
  tippableFightIds: string[];
  initialUntipped: string[];
  /** whether this gala offers a Fight of the Night pick at all */
  fotnAvailable: boolean;
  initialFotnPicked: boolean;
  children: React.ReactNode;
}) {
  const [untipped, setUntipped] = useState(() => new Set(initialUntipped));
  const [fotnPicked, setFotnPicked] = useState(initialFotnPicked);

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
    function onFotn(e: Event) {
      setFotnPicked((e as CustomEvent<{ picked: boolean }>).detail.picked);
    }
    window.addEventListener("tip-state-changed", onChange);
    window.addEventListener("fotn-state-changed", onFotn);
    return () => {
      window.removeEventListener("tip-state-changed", onChange);
      window.removeEventListener("fotn-state-changed", onFotn);
    };
  }, []);

  function goToFotn() {
    document.getElementById("fotn")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const total = tippableFightIds.length;
  const remaining = tippableFightIds.filter((id) => untipped.has(id)).length;
  const tipped = total - remaining;

  function goToFights() {
    const target = tippableFightIds.find((id) => untipped.has(id)) ?? tippableFightIds[0];
    if (target) {
      document.getElementById(`fight-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
      {total > 0 && (
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="text-xs font-medium tabular-nums">
            Natipováno {tipped}/{total}
          </span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <span
              className="block h-full rounded-full bg-accent transition-all"
              style={{ width: `${total ? Math.round((tipped / total) * 100) : 0}%` }}
            />
          </span>
        </div>
      )}
      {fotnAvailable && !fotnPicked && (
        // The picker sits below the card on purpose - fights first, then crown
        // the best one - but that made it easy to scroll past. This keeps it
        // on the radar without moving it back up.
        <button
          type="button"
          onClick={goToFotn}
          className="mb-2.5 flex w-full items-center gap-1.5 rounded-lg border border-yellow-600/50 bg-accent/10 px-2.5 py-1.5 text-left text-xs font-medium dark:border-accent/40"
        >
          <Star className="size-3.5 shrink-0 text-yellow-700 dark:text-accent" />
          <span className="flex-1">Ještě ti chybí tip na zápas večera (+2 b.)</span>
          <ArrowDown className="size-3.5 shrink-0 text-neutral-400" />
        </button>
      )}
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={goToFights}
          className="flex flex-[1.35] flex-col items-center justify-center gap-0.5 rounded-xl bg-accent px-3 py-2 text-black outline-none transition-transform hover:bg-[#e6bf00] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          <span className="flex items-center gap-1.5 text-sm font-bold leading-tight">
            {remaining > 0 ? `Dotipovat (${remaining})` : "Upravit tipy"}
            <ArrowDown className="size-4" strokeWidth={2.6} />
          </span>
          <span className="text-[10.5px] font-medium leading-tight text-black/60">
            s detaily o zápasnících níže
          </span>
        </button>
        {children}
      </div>
    </div>
  );
}
