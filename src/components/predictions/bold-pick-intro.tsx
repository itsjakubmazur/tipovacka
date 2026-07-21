"use client";

import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";

const SEEN_KEY = "boldpick-intro-seen-v1";

/** One-time "what's this new jistotka thing" callout on the event
 * header - shown until dismissed (per device), so the whole group
 * learns the mechanic once without it nagging forever afterwards. The
 * "?" on each fight card keeps the explanation available on demand. */
export function BoldPickIntro() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot localStorage read on mount, no external state to sync from
      if (!localStorage.getItem(SEEN_KEY)) setShow(true);
    } catch {
      // localStorage unavailable - just don't show the intro
    }
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // ignore
    }
  }

  if (!show) return null;

  return (
    <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#FFD400]/50 bg-[#FFD400]/10 p-3 text-sm shadow-lg shadow-black/15 backdrop-blur-lg dark:shadow-black/40">
      <Star className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-[#FFD400]" fill="currentColor" />
      <p className="flex-1 text-neutral-700 dark:text-neutral-200">
        <span className="font-semibold">Novinka – Jistotka.</span> U jednoho zápasu na kartě klepni na
        hvězdičku „Dát jistotku“. Body z něj se ti pak počítají <strong>dvakrát</strong>. Vyber si zápas,
        kterým sis nejjistější.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Zavřít"
        className="shrink-0 rounded-full p-1 text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
