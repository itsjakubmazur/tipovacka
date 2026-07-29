"use client";

import { useEffect, useRef, useState } from "react";

/** A number that rolls up to its value instead of just appearing.
 *
 * Re-runs whenever `value` changes, counting from whatever was on screen, so
 * it works both for a first reveal (from 0) and for a score ticking up. Falls
 * back to the plain number for prefers-reduced-motion. */
export function CountUp({
  value,
  from = 0,
  durationMs = 750,
  className,
}: {
  value: number;
  from?: number;
  durationMs?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const displayed = useRef(value);
  const started = useRef(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // First pass counts up from `from`; later changes count from wherever the
    // number currently sits.
    const start = started.current ? displayed.current : from;
    started.current = true;

    if (reduceMotion || start === value) {
      displayed.current = value;
      setShown(value);
      return;
    }

    let raf = 0;
    let t0: number | null = null;
    const step = (now: number) => {
      if (t0 === null) t0 = now;
      const p = Math.min((now - t0) / durationMs, 1);
      // ease-out: fast off the mark, settles gently on the final number
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(start + (value - start) * eased);
      displayed.current = next;
      setShown(next);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, from, durationMs]);

  return <span className={className}>{shown}</span>;
}
