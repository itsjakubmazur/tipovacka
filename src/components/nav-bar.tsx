import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { StandalonePing } from "@/components/standalone-ping";
import { ThemeToggle } from "@/components/theme-toggle";
import { DesktopNav, MobileNav } from "@/components/nav-links";

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
        .select("is_admin, is_superadmin")
        .eq("id", user.id)
        .single();
      isAdmin = (profile?.is_admin || profile?.is_superadmin) ?? false;
    }
  }

  if (!user) {
    return (
      <header className="sticky top-0 z-40 border-b border-neutral-200 dark:border-neutral-800 bg-black">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="whitespace-nowrap font-bold tracking-tight text-white">
            OKTAGON <span className="text-accent">GARÁŽ</span>
            <span className="hidden sm:inline"> Tipovačka</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-black hover:bg-[#e6bf00]"
            >
              Přihlásit se
            </Link>
            <ThemeToggle className="text-white/80 hover:text-accent" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-neutral-200 dark:border-neutral-800 bg-black">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/events" className="whitespace-nowrap font-bold tracking-tight text-white">
            OKTAGON <span className="text-accent">GARÁŽ</span>
            <span className="hidden sm:inline"> Tipovačka</span>
          </Link>
          <div className="flex items-center gap-4">
            <DesktopNav isAdmin={isAdmin} />
            <div className="hidden items-center gap-4 md:flex">
              <SignOutButton className="text-sm font-medium text-white/80 hover:text-accent" />
            </div>
            <ThemeToggle className="text-white/80 hover:text-accent" />
          </div>
        </div>
      </header>

      <MobileNav isAdmin={isAdmin} />
      <StandalonePing userId={user.id} />
    </>
  );
}
