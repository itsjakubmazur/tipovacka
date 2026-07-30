import { cn } from "@/lib/utils";

/** The app's one section-title style, and it always sits *above* its card,
 * never inside it.
 *
 * A title inside the first card reads as part of that card; outside, the
 * gap above it becomes the divider between groups of cards, which is the
 * whole job of a section title. Sub-labels within a list (card segments,
 * "Zrušené zápasy") use the smaller uppercase style instead - that's a
 * different level, not an alternative to this one. */
export function SectionHeading({
  icon,
  children,
  className,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn("flex items-center gap-2 text-lg font-semibold", className)}>
      {icon && <span className="text-yellow-600 dark:text-accent">{icon}</span>}
      {children}
    </h2>
  );
}

/** Section title + its card(s), with the gap that separates one section
 * from the next. */
export function Section({
  icon,
  title,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <SectionHeading icon={icon}>{title}</SectionHeading>
      {children}
    </section>
  );
}
