"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- next-themes hydration guard, no external state to sync from
    setMounted(true);
  }, []);

  // Reserve the same footprint before mount so the header doesn't jump.
  if (!mounted) return <span className="h-8 w-[104px]" aria-hidden />;

  const isDark = resolvedTheme === "dark";
  const next = isDark ? "light" : "dark";
  // The label names what you'll get, not what you're in - that's the bit an
  // icon alone can't say.
  const label = isDark ? "Světlý" : "Tmavý";
  const description = isDark ? "Přepnout na světlý režim" : "Přepnout na tmavý režim";

  function toggle() {
    const doc = document as ViewTransitionDocument;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // No View Transitions (older Safari/Firefox) or the viewer asked for less
    // motion: just switch.
    if (!doc.startViewTransition || reduceMotion) {
      setTheme(next);
      return;
    }

    // Wipe the new theme in as a circle growing out of the button.
    const rect = buttonRef.current?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : 0;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = doc.startViewTransition(() => {
      // startViewTransition snapshots the DOM when this callback returns, so
      // the theme class has to be applied synchronously.
      flushSync(() => setTheme(next));
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`],
        },
        {
          duration: 620,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={toggle}
      aria-label={description}
      title={description}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-white/25 px-2.5 py-1 text-xs font-medium transition-colors hover:border-accent/60",
        className
      )}
    >
      {isDark ? <Sun className="size-4 shrink-0" /> : <Moon className="size-4 shrink-0" />}
      {label}
    </button>
  );
}
