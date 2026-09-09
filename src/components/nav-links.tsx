"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Trophy, Swords, User, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/events", label: "Galavečery", icon: Swords },
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
  const listRef = useRef<HTMLDivElement | null>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const [compact, setCompact] = useState(false);
  const items = isAdmin
    ? [...navItems, { href: "/admin", label: "Admin", icon: ShieldCheck }]
    : navItems;

  /* Once the page has scrolled you are reading, not navigating, so the bar
   * hands its labels back to the content and keeps the icons. Two different
   * thresholds on purpose: collapsing and expanding at the same pixel makes
   * the bar flicker when a finger rests right on it. */
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setCompact((was) => (was ? window.scrollY > 48 : window.scrollY > 96));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // The desktop nav has always slid a pill between its tabs; down here the
  // active tab just turned yellow in place. Same measurement, same movement -
  // the two navs are the same control at two sizes. Re-measured on `compact`
  // too: collapsing changes every item's width under the pill.
  useLayoutEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    setPill(active ? { left: active.offsetLeft, width: active.offsetWidth } : null);
  }, [pathname, isAdmin, compact]);

  return (
    /* pointer-events-none on the frame, auto on the capsule: the bar no longer
     * spans the screen, and the gap either side of it has to stay tappable. */
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div
        className={cn(
          "glass-bar glass-bar-floating pointer-events-auto rounded-full transition-[padding] duration-300 ease-out motion-reduce:transition-none",
          compact ? "p-1.5" : "p-2"
        )}
      >
        <div ref={listRef} className="relative flex">
          {pill && (
            <span
              aria-hidden
              className="glass-accent-soft absolute inset-y-0 rounded-full border transition-all duration-300 ease-out motion-reduce:transition-none"
              style={{ left: pill.left, width: pill.width }}
            />
          )}
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
                  // the bottom bar is white in light mode, so the active item
                  // can't use the raw accent - yellow on white is unreadable
                  "relative z-10 flex flex-col items-center justify-center gap-1 rounded-full transition-all duration-300 ease-out motion-reduce:transition-none",
                  // 44px square when collapsed - the touch target survives
                  // losing the label
                  compact ? "size-11" : "min-w-[4.25rem] px-2 py-2",
                  active
                    ? "font-semibold text-yellow-700 dark:font-normal dark:text-accent"
                    : "text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white"
                )}
              >
                <Icon className="size-5 shrink-0" />
                {/* Collapsed to zero rather than unmounted: the width and the
                    label shrink as one movement instead of the label popping
                    out from under a still-wide pill, and screen readers keep
                    reading the destination either way. */}
                <span
                  className={cn(
                    "block overflow-hidden text-xs leading-4 transition-all duration-300 ease-out motion-reduce:transition-none",
                    compact ? "max-h-0 opacity-0" : "max-h-4 opacity-100"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
