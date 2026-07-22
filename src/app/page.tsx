import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    redirect("/events");
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">
        OKTAGON GARÁŽ <span className="text-black bg-accent px-1">Tipovačka</span>
      </h1>
      <p className="max-w-md text-neutral-600 dark:text-neutral-400">
        Tipuj vítěze, způsob ukončení a kolo u zápasů galavečerů OKTAGON a
        poměř se s kamarády v žebříčku.
      </p>
      <div className="flex gap-3">
        <Button asChild variant="accent" size="lg">
          <Link href="/login">Registrovat se</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">Přihlásit se</Link>
        </Button>
      </div>
    </div>
  );
}
