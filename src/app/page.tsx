import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">
        OKTAGON <span className="text-black bg-[#FFD400] px-1">Tipovačka</span>
      </h1>
      <p className="max-w-md text-neutral-600">
        Tipuj vítěze, způsob ukončení a kolo u zápasů galavečerů OKTAGON a
        poměř se s kamarády v žebříčku.
      </p>
      <div className="flex gap-3">
        <Button asChild variant="accent" size="lg">
          <Link href="/events">Zobrazit galavečery</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">Přihlásit se</Link>
        </Button>
      </div>
    </div>
  );
}
