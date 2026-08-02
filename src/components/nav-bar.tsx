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
      <header className="glass-floating glass-chrome sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 lg:max-w-5xl xl:max-w-6xl">
          <Link href="/" className="whitespace-nowrap font-bold tracking-tight text-white">
            OKTAGON <span className="text-accent">GARÁŽ</span>
            <span className="hidden sm:inline"> Tipovačka</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="glass-accent rounded-md px-3 py-1.5 text-sm font-semibold"
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
      <header className="glass-floating glass-chrome sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 lg:max-w-5xl xl:max-w-6xl">
          <Link href="/events" className="whitespace-nowrap font-bold tracking-tight text-white">
            OKTAGON <span className="text-accent">GARÁŽ</span>
            <span className="hidden sm:inline"> Tipovačka</span>
          </Link>
          <div className="flex items-center gap-2">
            <DesktopNav isAdmin={isAdmin} />
            {/* a hairline keeps "where do I go" apart from "my account" */}
            <span className="hidden h-5 w-px bg-white/15 md:block" />
            <div className="hidden items-center md:flex">
              <SignOutButton className="rounded-full px-2.5 py-1.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white" />
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
