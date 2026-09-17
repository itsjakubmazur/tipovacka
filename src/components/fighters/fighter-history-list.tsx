"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { HistoryFightDetail } from "@/components/fighters/history-fight-detail";
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

function Row({ entry }: { entry: FighterHistoryEntry }) {
  return (
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
      <div className="min-w-0 flex-1 text-left">
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
        {/* For a draw or a no contest the chip above already is the whole
            story - repeating the word under it read like a rendering slip. */}
        {(entry.outcome === "win" || entry.outcome === "loss") && (
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
            {describeHistoryResult(entry)}
          </span>
        )}
      </div>
    </>
  );
}

/** Every OKTAGON fight of one fighter: who, where, and how it ended.
 *
 * The opponent's face is the point of the row - a list of names is a
 * spreadsheet, a list of faces is a career.
 *
 * `expandable` turns each row into the fight itself, unfolded in place: the
 * same card a gala page draws, minus the tipping half. The opponent's profile
 * is then a link *inside* that card rather than the row's own destination -
 * tapping a fight should show you the fight, and getting to the other man is
 * the step after, not instead. Inside the sheet on a gala card the rows stay
 * plain: a fight card unfolding inside a dialog opened over a fight card is
 * one nesting too many. */
export function FighterHistoryList({
  history,
  expandable = false,
  /** only without `expandable` - the row itself walks to the opponent */
  linkOpponents = false,
  className,
}: {
  history: FighterHistoryEntry[];
  expandable?: boolean;
  linkOpponents?: boolean;
  className?: string;
}) {
  // Which fights have ever been opened, not just which one is open now: a
  // closed card keeps its fetched fight, so reopening it is instant and does
  // not ask the database the same question twice.
  const [open, setOpen] = useState<number | null>(null);
  const [everOpened, setEverOpened] = useState<Set<number>>(new Set());

  if (history.length === 0) return null;

  return (
    <ul
      className={cn(
        "glass-surface divide-y divide-black/5 rounded-xl border dark:divide-white/5",
        className
      )}
    >
      {history.map((entry) => {
        const id = entry.oktagon_fight_id;

        if (expandable) {
          const isOpen = open === id;
          return (
            <li key={id}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => {
                  setOpen(isOpen ? null : id);
                  if (!isOpen) setEverOpened((prev) => new Set(prev).add(id));
                }}
                className="flex w-full items-center gap-3 px-3 py-2 outline-none transition-colors hover:bg-black/[0.03] focus-visible:bg-black/[0.03] dark:hover:bg-white/5 dark:focus-visible:bg-white/5"
              >
                <Row entry={entry} />
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 text-neutral-400 transition-transform duration-300 motion-reduce:transition-none",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
              <Reveal open={isOpen}>
                {everOpened.has(id) && <HistoryFightDetail entry={entry} />}
              </Reveal>
            </li>
          );
        }

        const linked = linkOpponents && entry.opponent_fighter_id;
        return (
          <li key={id}>
            {linked ? (
              <Link
                href={`/fighters/${entry.opponent_fighter_id}`}
                className="flex items-center gap-3 px-3 py-2 outline-none transition-colors hover:bg-black/[0.03] focus-visible:bg-black/[0.03] dark:hover:bg-white/5 dark:focus-visible:bg-white/5"
              >
                <Row entry={entry} />
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2">
                <Row entry={entry} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
