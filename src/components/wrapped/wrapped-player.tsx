"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause } from "lucide-react";
import type { Scene } from "@/lib/wrapped-scenes";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { PosterMosaic } from "@/components/wrapped/poster-mosaic";
import { WrappedScene } from "@/components/wrapped/wrapped-scene";
import { cn } from "@/lib/utils";

/** Taps that land on a control belong to that control - the share button and
 * the arrows must not also count as "next scene". */
function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("button, a, input, textarea, [role=button]"));
}

/** milliseconds a scene holds before advancing on its own */
const DWELL = 7000;
const TICK = 50;

/** The Wrapped player: a stack of full-screen scenes you tap or swipe
 * through, with the season's posters behind all of them.
 *
 * Deliberately single-theme. Wrapped isn't another screen of the app, it's an
 * event - it commits to the dark, poster-lit look in both themes rather than
 * inheriting the app's chrome.
 *
 * The last scene never auto-advances: it's the share card, and sliding off it
 * would be actively hostile. */
export function WrappedPlayer({ scenes, posters }: { scenes: Scene[]; posters: string[] }) {
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [held, setHeld] = useState(false);
  const reduce = usePrefersReducedMotion();
  const [autoplay, setAutoplay] = useState(true);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const last = scenes.length - 1;
  const atEnd = index >= last;

  const go = useCallback(
    (delta: number) => {
      setIndex((prev) => Math.min(last, Math.max(0, prev + delta)));
      setElapsed(0);
    },
    [last]
  );

  useEffect(() => {
    // asking for less motion also means not being moved along on a timer
    if (!autoplay || reduce || held || atEnd) return;
    const id = setInterval(() => {
      setElapsed((prev) => {
        if (prev + TICK >= DWELL) {
          setIndex((i) => Math.min(last, i + 1));
          return 0;
        }
        return prev + TICK;
      });
    }, TICK);
    return () => clearInterval(id);
  }, [autoplay, reduce, held, atEnd, last]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const scene = scenes[index];
  const progress = atEnd ? 1 : elapsed / DWELL;

  return (
    <div
      className="relative flex h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] w-full flex-col overflow-hidden bg-neutral-950 select-none md:h-[calc(100dvh-3.5rem)] md:rounded-2xl"
      onPointerDown={(event) => {
        if (isInteractive(event.target)) return;
        touchStart.current = { x: event.clientX, y: event.clientY };
        setHeld(true);
      }}
      onPointerUp={(event) => {
        setHeld(false);
        const start = touchStart.current;
        touchStart.current = null;
        if (!start || isInteractive(event.target)) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        // a horizontal drag is a swipe; anything else is a tap, and where you
        // tapped decides the direction
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
          go(dx < 0 ? 1 : -1);
          return;
        }
        if (Math.abs(dx) > 12 || Math.abs(dy) > 12) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        go(event.clientX - bounds.left < bounds.width * 0.32 ? -1 : 1);
      }}
      onPointerCancel={() => setHeld(false)}
    >
      <PosterMosaic posters={posters} />

      {/* story progress - one segment per scene, the current one filling */}
      <div className="relative z-20 flex gap-1 px-3 pt-3">
        {scenes.map((_, i) => (
          <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full origin-left rounded-full bg-white"
              style={{
                transform: `scaleX(${i < index ? 1 : i === index ? progress : 0})`,
                transition: i === index ? "transform 50ms linear" : "none",
              }}
            />
          </div>
        ))}
      </div>

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto py-4">
        {/* keyed so every scene replays its own entrance */}
        <WrappedScene key={index} scene={scene} />
      </div>

      <div className="relative z-20 flex items-center justify-between px-4 pb-4 text-white/60">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            go(-1);
          }}
          disabled={index === 0}
          aria-label="Předchozí"
          className="rounded-full p-2 transition-opacity disabled:opacity-25"
        >
          <ChevronLeft className="size-5" />
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setAutoplay((prev) => !prev);
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
            autoplay && !reduce ? "text-white/50 hover:text-white" : "bg-white/10 text-white"
          )}
        >
          <Pause className="size-3.5" />
          {autoplay && !reduce ? "Zastavit posun" : "Posouvá se ručně"}
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            go(1);
          }}
          disabled={atEnd}
          aria-label="Další"
          className="rounded-full p-2 transition-opacity disabled:opacity-25"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  );
}
