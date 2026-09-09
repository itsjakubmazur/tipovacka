"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { Trophy, Swords, User, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrolledDown } from "@/lib/use-scrolled-down";

const navItems = [
  { href: "/events", label: "Gala", icon: Swords },
  { href: "/leaderboard", label: "Žebříček", icon: Trophy },
  { href: "/profile", label: "Profil", icon: User },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin
    ? [...navItems, { href: "/admin", label: "Admin", icon: ShieldCheck }]
    : navItems;

  // A highlight that slides between items beats a static underline: you see
  // where you came from and where you landed. Measured rather than guessed,
  // because the labels are different widths.
  const listRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    setPill(active ? { left: active.offsetLeft, width: active.offsetWidth } : null);
  }, [pathname, isAdmin]);

  return (
    <nav ref={listRef} className="relative hidden items-center gap-0.5 md:flex">
      {pill && (
        <span
          aria-hidden
          className="glass-thumb-chrome absolute inset-y-0 rounded-full transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{ left: pill.left, width: pill.width }}
        />
      )}
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active}
            aria-current={active ? "page" : undefined}
            // These destinations are always mounted (the nav itself is
            // sticky/fixed), so prefetching them in full - not just Next's
            // default shell-only prefetch for dynamic routes - means the RSC
            // payload (now served from cache server-side) is usually already
            // in hand by the time you tap.
            prefetch={true}
            className={cn(
              "relative z-10 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "text-accent" : "text-white/70 hover:text-white"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  /* Same signal drives the kecárna bubble - see useScrolledDown for why the
   * two share it rather than each watching scroll on their own. */
  const compact = useScrolledDown();
  const items = isAdmin
    ? [...navItems, { href: "/admin", label: "Admin", icon: ShieldCheck }]
    : navItems;

  return (
    /* pointer-events-none on the frame, auto on the capsule: the bar no longer
     * spans the screen, and the gap either side of it has to stay tappable. */
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div
        className={cn(
          "glass-bar pointer-events-auto flex rounded-full duration-300 ease-out",
          "transition-[padding] motion-reduce:transition-none",
          compact ? "p-1.5" : "p-2"
        )}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={active}
              aria-current={active ? "page" : undefined}
              prefetch={true}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 rounded-full duration-300 ease-out",
                "transition-[width,height,color] motion-reduce:transition-none",
                /* Both states carry an explicit width and height, and that is
                 * the whole reason the collapse animates at all. It used to go
                 * from `size-11` to a content-sized box (min-width plus
                 * padding, so width and height resolved to `auto`) - and CSS
                 * cannot interpolate to or from `auto`, so every browser
                 * simply snapped between the two sizes. Fixed track widths
                 * also mean the tabs stop jittering as labels of different
                 * lengths come and go - 68px is the longest label
                 * ("Žebříček", 48px) plus its padding, so nothing clips.
                 * 44px square collapsed keeps the touch target after the
                 * label is gone. */
                compact ? "h-11 w-11" : "h-14 w-[4.25rem]",
                // the bottom bar is white in light mode, so the active item
                // can't use the raw accent - yellow on white is unreadable
                active
                  ? "font-semibold text-yellow-900 dark:font-normal dark:text-accent"
                  : "text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white"
              )}
            >
              {/* The pill is the active item's own background rather than one
                  absolutely-positioned element measured across the row. That
                  measurement read offsetWidth in the same commit that started
                  the collapse, and mid-transition offsetWidth reports the
                  *current* animated width, not the target - so the pill froze
                  at whatever width the item had that frame and ended up
                  hugging the icon while the label hung outside it. As a child
                  it is the item's own box: always the full width, label
                  included, and in step with the collapse on every frame
                  because it is the same animation. */}
              {active && (
                <span
                  aria-hidden
                  className="glass-thumb-accent animate-nav-pill absolute inset-0 rounded-full border"
                />
              )}
              <Icon className="relative size-5 shrink-0" />
              {/* Collapsed to zero rather than unmounted: the width and the
                  label shrink as one movement instead of the label popping
                  out from under a still-wide pill, and screen readers keep
                  reading the destination either way. */}
              <span
                className={cn(
                  "relative block max-w-full overflow-hidden text-xs leading-4 duration-300 ease-out",
                  "transition-[max-height,opacity] motion-reduce:transition-none",
                  compact ? "max-h-0 opacity-0" : "max-h-4 opacity-100"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
