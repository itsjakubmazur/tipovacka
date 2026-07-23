import { cn } from "@/lib/utils";

/** The shared brand lockup used in the nav and on the front door, so the
 * logged-out pages read as the same product as everything behind the login. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-bold tracking-tight", className)}>
      OKTAGON <span className="text-accent">GARÁŽ</span> Tipovačka
    </span>
  );
}
