import { cn } from "@/lib/utils";

/** Page title with its context on the line *above* it.
 *
 * Metadata used to sit under the heading, where it reads as an afterthought.
 * Above it, in small caps, it frames the title before you read it - you know
 * which season, which date, which venue before the name lands. Same idea as
 * the section labels on the fight card, one level up. */
export function PageHeading({
  eyebrow,
  children,
  className,
}: {
  /** short, factual, no sentence - "SEZÓNA 2026 · 12 TIPÉRŮ" */
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {eyebrow}
        </p>
      )}
      <h1 className={cn("text-xl font-bold lg:text-3xl", eyebrow && "mt-0.5")}>{children}</h1>
    </div>
  );
}
