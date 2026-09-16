import Image from "next/image";
import Link from "next/link";
import { describeHistoryResult } from "@/lib/fighter-history";
import { cn } from "@/lib/utils";
import type { FighterHistoryEntry } from "@/lib/types";

// A draw or a no contest is neither good nor bad, and .glass-pill on a chip
// this small reads as a rendering slip in light mode - same reason the form
// row carries its own neutral style.
const NEUTRAL =
  "border-black/10 bg-black/[0.06] text-neutral-600 dark:border-white/15 dark:bg-white/10 dark:text-neutral-300";

const OUTCOME_CHIPS: Record<string, string> = {
  win: "glass-green",
  loss: "glass-danger",
  draw: NEUTRAL,
  no_contest: NEUTRAL,
};

const OUTCOME_WORDS: Record<string, string> = {
  win: "Výhra",
  loss: "Prohra",
  draw: "Remíza",
  no_contest: "No contest",
};

/** Every OKTAGON fight of one fighter: who, where, and how it ended.
 *
 * The opponent's face is the point of the row - a list of names is a
 * spreadsheet, a list of faces is a career. An opponent we also have a row
 * for becomes a link, so you can walk from one fighter to the next; one we
 * only know as a name in somebody else's history stays plain text rather
 * than a link that 404s. */
export function FighterHistoryList({
  history,
  /** off inside the fight card's sheet: tapping through to another page from
   * a dialog opened over a card you are mid-tip on is not what anyone meant */
  linkOpponents = false,
  className,
}: {
  history: FighterHistoryEntry[];
  linkOpponents?: boolean;
  className?: string;
}) {
  if (history.length === 0) return null;

  return (
    <ul
      className={cn(
        "glass-surface divide-y divide-black/5 rounded-xl border dark:divide-white/5",
        className
      )}
    >
      {history.map((entry) => {
        const linked = linkOpponents && entry.opponent_fighter_id;
        const row = (
          <>
            <div className="relative size-9 shrink-0 overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
              {entry.opponent_photo_url && (
                <Image
                  src={entry.opponent_photo_url}
                  alt=""
                  fill
                  sizes="36px"
                  className="object-cover object-top"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{entry.opponent_name}</p>
              <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                {entry.event_label} · {new Date(entry.event_date).getFullYear()}
                {entry.title_fight && " · o titul"}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  OUTCOME_CHIPS[entry.outcome] ?? NEUTRAL
                )}
              >
                {OUTCOME_WORDS[entry.outcome] ?? "—"}
              </span>
              {/* For a draw or a no contest the chip above already is the
                  whole story - repeating the word under it read like a
                  rendering slip. */}
              {(entry.outcome === "win" || entry.outcome === "loss") && (
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {describeHistoryResult(entry)}
                </span>
              )}
            </div>
          </>
        );

        return (
          <li key={entry.oktagon_fight_id}>
            {linked ? (
              <Link
                href={`/fighters/${entry.opponent_fighter_id}`}
                className="flex items-center gap-3 px-3 py-2 outline-none transition-colors hover:bg-black/[0.03] focus-visible:bg-black/[0.03] dark:hover:bg-white/5 dark:focus-visible:bg-white/5"
              >
                {row}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
