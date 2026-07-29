"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <nav className="hidden items-center gap-4 md:flex">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          className={cn(
            "relative text-sm font-medium transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:rounded-full after:bg-accent after:transition-all after:content-['']",
            isActive(pathname, item.href)
              ? "text-accent after:w-full"
              : "text-white/80 hover:text-accent after:w-0"
          )}
        >
          {item.label}
        </Link>
      ))}
      {isAdmin && (
        <Link
          href="/admin"
          aria-current={isActive(pathname, "/admin") ? "page" : undefined}
          className={cn(
            "relative text-sm font-medium transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:rounded-full after:bg-accent after:transition-all after:content-['']",
            isActive(pathname, "/admin")
              ? "text-accent after:w-full"
              : "text-white/80 hover:text-accent after:w-0"
          )}
        >
          Admin
        </Link>
      )}
    </nav>
  );
}

export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-black md:hidden">
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
