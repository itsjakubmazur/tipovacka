import { StrikeMap, hasStrikeMap } from "@/components/fighters/strike-map";
import type { CareerStats } from "@/lib/data/fighter-profile";

type Tile = { label: string; value: number; hint?: string };

/** What the tracking system logged across a fighter's whole OKTAGON career.
 *
 * The count of tracked fights is printed rather than implied: the system was
 * not running for every gala (nothing at all for some of the older ones), so
 * "412 zásahů" without "z 9 sledovaných zápasů" next to it would read as a
 * career total when it is a sample. */
export function CareerStatsPanel({ career }: { career: CareerStats }) {
  const tiles: Tile[] = [
    { label: "Zásahy", value: career.hits },
    { label: "Tvrdé zásahy", value: career.significant_hits },
    {
      label: "Takedowny",
      value: career.takedowns,
      hint: career.takedown_attempts > 0 ? `z ${career.takedown_attempts} pokusů` : undefined,
    },
    { label: "Pokusy o submisi", value: career.submission_attempts },
  ].filter((tile) => tile.value > 0 || tile.label === "Zásahy");

  return (
    <div className="glass-surface flex flex-col gap-4 rounded-xl border p-4">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Tracking má data u{" "}
        <span className="font-bold tabular-nums text-black dark:text-white">{career.fights}</span>{" "}
        {career.fights === 1 ? "zápasu" : "zápasů"}. U starších galavečerů neběžel, takže tohle
        není celá kariéra — jen ta část, o které data existují.
      </p>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col">
            <dd className="text-2xl font-bold tabular-nums leading-none">{tile.value}</dd>
            <dt className="mt-1 text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {tile.label}
            </dt>
            {tile.hint && (
              <dd className="text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
                {tile.hint}
              </dd>
            )}
          </div>
        ))}
      </dl>

      {hasStrikeMap(career.targets) && (
        <div className="border-t border-black/5 pt-4 dark:border-white/10">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Kam mířil
          </p>
          <StrikeMap targets={career.targets} />
        </div>
      )}
    </div>
  );
}
