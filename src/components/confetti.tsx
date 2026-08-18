"use client";

import { useEffect, useRef, useState } from "react";

const COLORS = ["#ffd400", "#ffe680", "#ffffff", "#f5a623", "#c99a00"];
const PIECES = 110;
const FADE_MS = 700;

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  spin: number;
  angle: number;
};

/** A short burst of confetti over the whole screen. Purely decorative: it sits
 * above everything but never takes a click, and removes itself when it's done
 * so nothing lingers. Skipped entirely for prefers-reduced-motion. */
export function Confetti({ durationMs = 2600, onceKey }: { durationMs?: number; onceKey?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);
  const [allowed, setAllowed] = useState(!onceKey);

  useEffect(() => {
    if (!onceKey) return;
    const storageKey = `confetti:${onceKey}`;
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, "1");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is client-only; first paint must not fire confetti on a repeat visit
    setAllowed(true);
  }, [onceKey]);

  useEffect(() => {
    if (!allowed) return;
    // Reduced motion: draw nothing at all. The canvas stays mounted but is
    // transparent and never takes a pointer event, so it changes nothing.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const pieces: Piece[] = Array.from({ length: PIECES }, () => ({
      x: Math.random() * width,
      // staggered above the fold, so it rains in rather than appearing at once
      y: -20 - Math.random() * height * 0.8,
      vx: (Math.random() - 0.5) * 60,
      vy: 140 + Math.random() * 220,
      size: 5 + Math.random() * 7,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      spin: (Math.random() - 0.5) * 8,
      angle: Math.random() * Math.PI,
    }));

    let raf = 0;
    let start: number | null = null;
    let last: number | null = null;

    const frame = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.05);
      last = now;

      ctx.clearRect(0, 0, width, height);
      // ease the whole burst out at the end instead of cutting it
      const remaining = durationMs - elapsed;
      ctx.globalAlpha = remaining < FADE_MS ? Math.max(0, remaining / FADE_MS) : 1;

      for (const p of pieces) {
        p.vy += 320 * dt; // gravity
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (elapsed < durationMs) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, width, height);
        setDone(true);
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, allowed]);

  if (!allowed || done) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[70]"
    />
  );
}
