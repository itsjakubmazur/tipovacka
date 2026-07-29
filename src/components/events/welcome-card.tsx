"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, BookOpen, Sparkles } from "lucide-react";

const STORAGE_KEY = "welcome_seen_v1";

/** One-time hello for newly invited players. The front door is intentionally
 * bare, so the first thing inside points them at how the game works. Dismissal
 * is remembered per device (localStorage) - a nudge, not critical state. */
export function WelcomeCard() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of localStorage on mount, no external store to sync from
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
    } catch {
      // private mode / storage blocked - just don't show it
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  }

  return (
    <div className="relative flex flex-col gap-2 overflow-hidden rounded-xl border border-yellow-600/60 dark:border-accent/40 bg-accent/10 p-4 shadow-lg shadow-black/10">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Zavřít"
        className="absolute right-2 top-2 rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-black/5 hover:text-black dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <X className="size-4" />
      </button>
      <p className="flex items-center gap-2 pr-8 text-sm font-semibold">
        <Sparkles className="size-4 text-yellow-600 dark:text-accent" />
        Vítej v Tipovačce!
      </p>
      <p className="text-sm text-neutral-700 dark:text-neutral-200">
        Tipuješ vítěze, způsob ukončení a kolo u zápasů OKTAGONU a soupeříš s partou o body i o startovné.
        Než se pustíš do prvních tipů, mrkni na pravidla a bodování.
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Link
          href="/pravidla"
          onClick={dismiss}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-black transition-colors hover:brightness-95"
        >
          <BookOpen className="size-4" />
          Jak se hraje
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="text-sm font-medium text-neutral-500 hover:text-black dark:text-neutral-300 dark:hover:text-white"
        >
          Rozumím, začínám tipovat
        </button>
      </div>
    </div>
  );
}
