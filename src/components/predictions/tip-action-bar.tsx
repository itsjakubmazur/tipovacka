"use client";

import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";

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
  children,
}: {
  tippableFightIds: string[];
  initialUntipped: string[];
  children: React.ReactNode;
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
