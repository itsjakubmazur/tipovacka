"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { Trophy, Swords, User, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/events", label: "Galavečery", icon: Swords },
  { href: "/leaderboard", label: "Žebříček", icon: Trophy },
  { href: "/groups", label: "Skupiny", icon: Users },
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
          className="absolute inset-y-0 rounded-full bg-white/10 ring-1 ring-inset ring-white/15 transition-all duration-300 ease-out motion-reduce:transition-none"
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

  return (
    <nav className="glass-floating fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="mx-auto flex max-w-3xl px-6 pb-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                // the bottom bar is white in light mode, so the active item
                // can't use the raw accent - yellow on white is unreadable
                "mx-0.5 flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs transition-colors",
                active
                  ? "bg-accent/10 font-semibold text-yellow-700 dark:font-normal dark:text-accent"
                  : "text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white"
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href="/admin"
            aria-current={isActive(pathname, "/admin") ? "page" : undefined}
            className={cn(
              "mx-0.5 flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs transition-colors",
              isActive(pathname, "/admin")
                ? "bg-accent/10 font-semibold text-yellow-700 dark:font-normal dark:text-accent"
                : "text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white"
            )}
          >
            <ShieldCheck className="size-5" />
            Admin
          </Link>
        )}
      </div>
    </nav>
  );
}
