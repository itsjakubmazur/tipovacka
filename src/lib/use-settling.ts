"use client";

import { useEffect, useState } from "react";

/** True for `ms` after `trigger` changes - "this thing is mid-animation".
 *
 * Exists for one reason: a `backdrop-filter` surface that moves or resizes
 * has to re-sample and re-blur its whole backdrop on every single frame, and
 * on a phone that is what turns a 300ms transition into a stutter. Layout is
 * not the culprit - measured at roughly 1ms a frame - the blur is. So the
 * surfaces that animate drop their blur for the duration and take it back
 * once they have settled, which cannot be seen mid-motion and costs nothing
 * when still.
 *
 * The flag is raised during render rather than from an effect: setting state
 * in an effect would paint one frame of blurred glass before the class lands,
 * which is the single frame that would stutter. Deliberately false on the
 * first render too - a surface that was always there is not animating. */
export function useSettling(trigger: unknown, ms = 320): boolean {
  const [previous, setPrevious] = useState(trigger);
  const [token, setToken] = useState(0);
  const [settling, setSettling] = useState(false);

  if (previous !== trigger) {
    setPrevious(trigger);
    // re-armed per change, so a second change mid-flight restarts the timer
    // instead of inheriting the leftovers of the first
    setToken((t) => t + 1);
    setSettling(true);
  }

  useEffect(() => {
    if (!settling) return;
    const id = setTimeout(() => setSettling(false), ms);
    return () => clearTimeout(id);
  }, [settling, token, ms]);

  return settling;
}
