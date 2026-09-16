import { Fragment } from "react";
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

function share(targets: Record<string, number>, area: string): number {
  const total = totalStrikes(targets);
  return total > 0 ? (targets[area] ?? 0) / total : 0;
}

/** The figure itself: where the punches landed, as a body rather than three
 * more numbers in a list - which is the one thing a diagram does better than
 * a table: you read "he went downstairs all night" at a glance.
 *
 * Deliberately a diagram, not a photo-real silhouette: a circle, a torso and
 * two legs are unmistakably a person at 120px tall, and pretending to anatomy
 * we don't have would only invite questions about which shin took what.
 *
 * The shares drive opacity, but the counts are always printed next to it -
 * colour alone never carries a number here. */
export function StrikeFigure({
  targets,
  side = "a",
  className,
}: {
  targets: Record<string, number>;
  side?: "a" | "b";
  className?: string;
}) {
  // A zone with a single hit in a busy fight would round to invisible, so the
  // floor is "clearly tinted" rather than "technically non-zero".
  const fill = (area: string) => ((targets[area] ?? 0) === 0 ? 0.08 : 0.25 + share(targets, area) * 0.75);

  return (
    <svg
      viewBox="0 0 60 120"
      className={cn("h-24 w-12 shrink-0", className)}
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

      <g className={side === "a" ? "fill-accent" : "fill-blue-600 dark:fill-blue-500"}>
        <circle cx="30" cy="12" r="10" opacity={fill("head")} />
        <rect x="17" y="25" width="26" height="34" rx="7" opacity={fill("body")} />
        <g opacity={fill("legs")}>
          <rect x="19" y="62" width="9" height="54" rx="4.5" />
          <rect x="32" y="62" width="9" height="54" rx="4.5" />
        </g>
      </g>
    </svg>
  );
}

/** Both fighters' areas as one table: the three labels run down the middle
 * and each side's numbers sit on its own side, with the figures on the
 * outside.
 *
 * Same shape as the totals above it, deliberately - two separate figure+list
 * blocks meant the words "Hlava / Tělo / Nohy" appeared twice and each side's
 * percentages had so little room they wrapped onto a second line. One centre
 * column says it once and gives the numbers the width they needed. */
export function StrikeComparison({
  a,
  b,
  className,
}: {
  a: Record<string, number>;
  b: Record<string, number>;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <StrikeFigure targets={a} side="a" />

      {/* One grid for all three rows, not a grid per row: with a grid each,
          every row sized its own columns, so "HLAVA" and "TĚLO" were
          different widths and the numbers either side drifted out of line.
          Five shared columns line the whole block up vertically. */}
      <dl className="grid min-w-0 flex-1 grid-cols-[1fr_auto_auto_auto_1fr] items-baseline gap-x-2 gap-y-2.5">
        {STRIKE_AREAS.map((area) => (
          <Fragment key={area}>
            {/* mirrored on purpose: the bold count hugs the label on both
                sides, so the eye compares the two numbers across one word
                instead of across the whole row */}
            <dd className="text-right text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
              {Math.round(share(a, area) * 100)} %
            </dd>
            <dd className="text-right text-sm font-bold tabular-nums">{a[area] ?? 0}</dd>
            <dt className="text-center text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {areaLabel(area)}
            </dt>
            <dd className="text-left text-sm font-bold tabular-nums">{b[area] ?? 0}</dd>
            <dd className="text-left text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
              {Math.round(share(b, area) * 100)} %
            </dd>
          </Fragment>
        ))}
      </dl>

      <StrikeFigure targets={b} side="b" />
    </div>
  );
}

/** One fighter's areas - the career panel, where there is nothing to compare
 * against, so the label and its numbers simply read left to right. */
export function StrikeMap({
  targets,
  side = "a",
  className,
}: {
  targets: Record<string, number>;
  side?: "a" | "b";
  className?: string;
}) {
  if (totalStrikes(targets) === 0) return null;

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <StrikeFigure targets={targets} side={side} />
      <dl className="grid min-w-0 grid-cols-[auto_auto_auto] items-baseline gap-x-2 gap-y-2.5">
        {STRIKE_AREAS.map((area) => (
          <Fragment key={area}>
            <dt className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {areaLabel(area)}
            </dt>
            <dd className="text-right text-sm font-bold tabular-nums">{targets[area] ?? 0}</dd>
            <dd className="text-right text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
              {Math.round(share(targets, area) * 100)} %
            </dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}
