import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-yellow-600 dark:text-accent">
        Nic tady není
      </p>
      <h1 className="text-2xl font-bold">Tuhle stránku nemáme</h1>
      <p className="max-w-sm text-sm text-neutral-600 dark:text-neutral-400">
        Buď špatný odkaz, nebo galavečer, který ještě není venku. Zpátky na karty.
      </p>
      <Button asChild variant="accent">
        <Link href="/events">Na galavečery</Link>
      </Button>
    </div>
  );
}
