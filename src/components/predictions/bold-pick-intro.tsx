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
    <div className="mt-2 flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/[0.07] px-3 py-2 text-xs text-neutral-600 dark:text-neutral-300">
      <Star className="size-3.5 shrink-0 text-yellow-600 dark:text-accent" fill="currentColor" />
      <p className="flex-1 leading-snug">
        <span className="font-semibold text-black dark:text-white">Novinka – Jistotka:</span> dej ×2 body
        na svůj nejjistější tip (hvězdička u zápasu).
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Zavřít"
        className="shrink-0 rounded-full p-0.5 text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
