import { cn } from "@/lib/utils";
import type { Fight, FightStats, FightStatsSide } from "@/lib/types";

type Row = { label: string; a: number; b: number };

/** Totals the external tracking system logged during the fight. Only ever
 * rendered once a fight is over - which is also the first moment the numbers
 * exist, so there is nothing here a tipper could have used. */
export function FightStatsPanel({ fight, stats }: { fight: Fight; stats: FightStats }) {
  const rows: Row[] = [
    { label: "Zásahy", a: stats.a.hits, b: stats.b.hits },
    { label: "Tvrdé zásahy", a: stats.a.significant_hits, b: stats.b.significant_hits },
    { label: "Takedowny", a: stats.a.takedowns, b: stats.b.takedowns },
    { label: "Pokusy o submisi", a: stats.a.submission_attempts, b: stats.b.submission_attempts },
  ].filter((row) => row.a > 0 || row.b > 0);

  if (rows.length === 0) return null;

  return (
    <div className="px-4 pb-3">
      {/* The two names are the legend - identity never rests on the colour
          alone, and each bar also grows from the centre towards its own
          fighter's side, the way the whole card is laid out. */}
      <div className="mb-2 flex items-baseline justify-between gap-2 text-[11px] font-bold uppercase tracking-wide">
        <span className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-accent" />
          <span className="truncate text-neutral-600 dark:text-neutral-300">
            {fight.fighter_a.name}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-neutral-600 dark:text-neutral-300">
            {fight.fighter_b.name}
          </span>
          {/* Brand yellow against brand blue: the pair separates far beyond
              the colourblind-safety threshold in every simulation, even though
              a yellow that light sits outside the usual lightness band for a
              mark. Deliberate - it is the app's own two-fighter vocabulary. */}
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-blue-600 dark:bg-blue-500" />
        </span>
      </div>

      <dl className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const max = Math.max(row.a, row.b, 1);
          return (
            <div key={row.label} className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
              <dd className="text-right text-xs font-bold tabular-nums">{row.a}</dd>
              <div className="flex flex-col items-center gap-0.5">
                <dt className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {row.label}
                </dt>
                {/* Two tracks meeting in the middle, each bar anchored to the
                    centre and growing outward. A 2px gap keeps the two fills
                    from reading as one bar when both sides are busy. */}
                <div className="flex w-full items-center gap-0.5">
                  <Bar value={row.a} max={max} side="a" />
                  <Bar value={row.b} max={max} side="b" />
                </div>
              </div>
              <dd className="text-xs font-bold tabular-nums">{row.b}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function Bar({ value, max, side }: { value: number; max: number; side: "a" | "b" }) {
  const share = max > 0 ? (value / max) * 100 : 0;
  return (
    <div
      className={cn(
        "h-1.5 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10",
        side === "a" ? "flex justify-end" : "flex justify-start"
      )}
    >
      <span
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none",
          side === "a" ? "bg-accent" : "bg-blue-600 dark:bg-blue-500"
        )}
        style={{ width: `${share}%` }}
      />
    </div>
  );
}

export function hasAnyStats(stats: FightStats | undefined): stats is FightStats {
  if (!stats) return false;
  const sum = (s: FightStatsSide) =>
    s.hits + s.significant_hits + s.takedowns + s.takedown_attempts + s.submission_attempts;
  return sum(stats.a) + sum(stats.b) > 0;
}
