import { cn } from "@/lib/utils";

/** The tracking system's own three areas, in the order a body has them.
 * Anything it starts reporting beyond these shows up in the totals row
 * rather than being silently dropped. */
export const STRIKE_AREAS = ["head", "body", "legs"] as const;
export type StrikeArea = (typeof STRIKE_AREAS)[number];

const AREA_LABELS: Record<string, string> = {
  head: "Hlava",
  body: "Tělo",
  legs: "Nohy",
};

export function areaLabel(area: string): string {
  return AREA_LABELS[area] ?? area;
}

export function totalStrikes(targets: Record<string, number>): number {
  return Object.values(targets).reduce((sum, n) => sum + n, 0);
}

export function hasStrikeMap(targets: Record<string, number> | undefined): boolean {
  return Boolean(targets) && totalStrikes(targets!) > 0;
}

/** Where the punches landed, as a figure rather than three more numbers in a
 * list - which is the one thing a body diagram does better than a table: you
 * read "he went downstairs all night" at a glance.
 *
 * Deliberately a diagram, not a photo-real silhouette: a circle, a torso and
 * two legs are unmistakably a person at 120px tall, and pretending to anatomy
 * we don't have would only invite questions about which shin took what.
 *
 * The share drives opacity, but every zone also prints its count - colour
 * alone never carries a number here, and at low contrast an almost-empty zone
 * would otherwise be indistinguishable from a missing one. */
export function StrikeMap({
  targets,
  /** which fighter's colour the zones take - matches the fight card's own
   * accent/blue pairing */
  side = "a",
  className,
}: {
  targets: Record<string, number>;
  side?: "a" | "b";
  className?: string;
}) {
  const total = totalStrikes(targets);
  if (total === 0) return null;

  const share = (area: string) => (targets[area] ?? 0) / total;

  // A zone with a single hit in a busy fight would round to invisible, so the
  // floor is "clearly tinted" rather than "technically non-zero".
  const fill = (area: string) => {
    const value = targets[area] ?? 0;
    if (value === 0) return 0.08;
    return 0.25 + share(area) * 0.75;
  };

  const zoneClass = side === "a" ? "fill-accent" : "fill-blue-600 dark:fill-blue-500";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <svg
        viewBox="0 0 60 120"
        className="h-28 w-14 shrink-0"
        role="img"
        aria-label={STRIKE_AREAS.map((a) => `${areaLabel(a)}: ${targets[a] ?? 0}`).join(", ")}
      >
        {/* the body underneath, so an untouched zone still reads as part of a
            figure instead of a hole in it */}
        <g className="fill-black/10 dark:fill-white/15">
          <circle cx="30" cy="12" r="10" />
          <rect x="17" y="25" width="26" height="34" rx="7" />
          <rect x="4" y="27" width="9" height="30" rx="4.5" />
          <rect x="47" y="27" width="9" height="30" rx="4.5" />
          <rect x="19" y="62" width="9" height="54" rx="4.5" />
          <rect x="32" y="62" width="9" height="54" rx="4.5" />
        </g>

        <g className={zoneClass}>
          <circle cx="30" cy="12" r="10" opacity={fill("head")} />
          <g opacity={fill("body")}>
            <rect x="17" y="25" width="26" height="34" rx="7" />
          </g>
          <g opacity={fill("legs")}>
            <rect x="19" y="62" width="9" height="54" rx="4.5" />
            <rect x="32" y="62" width="9" height="54" rx="4.5" />
          </g>
        </g>
      </svg>

      <dl className="flex min-w-0 flex-col gap-1 text-xs">
        {STRIKE_AREAS.map((area) => {
          const value = targets[area] ?? 0;
          return (
            <div key={area} className="flex items-baseline gap-2">
              <dt className="w-10 shrink-0 text-neutral-500 dark:text-neutral-400">
                {areaLabel(area)}
              </dt>
              <dd className="font-bold tabular-nums">{value}</dd>
              <dd className="text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
                {total > 0 ? `${Math.round(share(area) * 100)} %` : null}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
