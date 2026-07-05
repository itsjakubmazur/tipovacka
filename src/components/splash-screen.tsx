"use client";

import { useEffect, useState } from "react";

const MIN_VISIBLE_MS = 600;
const FADE_MS = 300;

/** Full-screen splash shown on every full document load (first visit,
 * hard refresh, PWA cold start). Server-rendered so it's visible from
 * the very first paint; hidden by React state AFTER hydration - never
 * by direct DOM mutation, which raced hydration and crashed the app
 * ("This page couldn't load"). The CSS splash-failsafe animation hides
 * it even if the JS bundle never loads. Client-side navigations don't
 * re-run this (the root layout persists) - those show loading.tsx. */
export function SplashScreen() {
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");

  useEffect(() => {
    const shownAt = Date.now();
    let fadeTimer: ReturnType<typeof setTimeout>;
    let goneTimer: ReturnType<typeof setTimeout>;

    function startFade() {
      const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
      fadeTimer = setTimeout(() => {
        setPhase("fading");
        goneTimer = setTimeout(() => setPhase("gone"), FADE_MS);
      }, wait);
    }

    if (document.readyState === "complete") {
      startFade();
    } else {
      window.addEventListener("load", startFade, { once: true });
    }
    return () => {
      window.removeEventListener("load", startFade);
      clearTimeout(fadeTimer);
      clearTimeout(goneTimer);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden
      className={`splash-failsafe fixed inset-0 z-[100] flex flex-col items-center justify-center gap-2 bg-background transition-opacity duration-300 ${
        phase === "fading" ? "opacity-0" : "opacity-100"
      }`}
    >
      <span className="brand-loader whitespace-nowrap text-3xl font-bold tracking-tight">
        OKTAGON GARÁŽ
      </span>
      <span className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400 dark:text-neutral-500">
        Tipovačka
      </span>
    </div>
  );
}
