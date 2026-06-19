import Link from "next/link";
import { Trophy, Swords, User, ShieldCheck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/sign-out-button";

const navItems = [
  { href: "/events", label: "Galavečery", icon: Swords },
  { href: "/leaderboard", label: "Žebříček", icon: Trophy },
  { href: "/groups", label: "Skupiny", icon: Users },
  { href: "/profile", label: "Profil", icon: User },
];

export async function NavBar() {
  let user = null;
  let isAdmin = false;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();
      isAdmin = profile?.is_admin ?? false;
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-black">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="font-bold tracking-tight text-white">
            OKTAGON <span className="text-[#FFD400]">Tipovačka</span>
          </Link>
          <nav className="hidden items-center gap-4 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-white/80 hover:text-[#FFD400]"
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className="text-sm font-medium text-white/80 hover:text-[#FFD400]"
              >
                Admin
              </Link>
            )}
            {!user && (
              <Link
                href="/login"
                className="rounded-md bg-[#FFD400] px-3 py-1.5 text-sm font-semibold text-black hover:bg-[#e6bf00]"
              >
                Přihlásit se
              </Link>
            )}
            {user && (
              <SignOutButton className="text-sm font-medium text-white/80 hover:text-[#FFD400]" />
            )}
          </nav>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white md:hidden">
        <div className="mx-auto flex max-w-3xl">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-1 flex-col items-center gap-1 py-2 text-xs text-neutral-600 hover:text-black"
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className="flex flex-1 flex-col items-center gap-1 py-2 text-xs text-neutral-600 hover:text-black"
            >
              <ShieldCheck className="size-5" />
              Admin
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
