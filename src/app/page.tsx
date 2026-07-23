import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    redirect("/events");
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <Wordmark className="text-3xl sm:text-4xl" />
      <p className="max-w-sm text-neutral-600 dark:text-neutral-400">
        Uzavřená tipovačka na galavečery OKTAGON. Vstup jen na zvací kód.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="accent" size="lg">
          <Link href="/login?mode=register">Mám zvací kód</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">Přihlásit se</Link>
        </Button>
      </div>
    </div>
  );
}
