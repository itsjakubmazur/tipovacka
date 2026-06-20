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
          className={cn(
            "text-sm font-medium",
            isActive(pathname, item.href)
              ? "text-[#FFD400]"
              : "text-white/80 hover:text-[#FFD400]"
          )}
        >
          {item.label}
        </Link>
      ))}
      {isAdmin && (
        <Link
          href="/admin"
          className={cn(
            "text-sm font-medium",
            isActive(pathname, "/admin") ? "text-[#FFD400]" : "text-white/80 hover:text-[#FFD400]"
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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black md:hidden">
      <div className="mx-auto flex max-w-3xl px-6 pb-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
                active
                  ? "text-[#FFD400]"
                  : "text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white"
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
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
              isActive(pathname, "/admin")
                ? "text-[#FFD400]"
                : "text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white"
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
