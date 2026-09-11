"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/modal";
import { FighterForm } from "@/components/fighters/fighter-form";
import {
  describeHistoryResult,
  formatOktagonRecord,
  oktagonRecord,
  recentForm,
} from "@/lib/fighter-history";
import { cn } from "@/lib/utils";
import type { Fighter, FighterHistoryEntry } from "@/lib/types";

const NEUTRAL_CHIP =
  "border-black/10 bg-black/[0.06] text-neutral-600 dark:border-white/15 dark:bg-white/10 dark:text-neutral-300";

const OUTCOME_CHIPS: Record<string, string> = {
  win: "glass-green",
  loss: "glass-danger",
  draw: NEUTRAL_CHIP,
  no_contest: NEUTRAL_CHIP,
};

const OUTCOME_WORDS: Record<string, string> = {
  win: "Výhra",
  loss: "Prohra",
  draw: "Remíza",
  no_contest: "No contest",
};

/** Everything we know about one fighter, on top of the card rather than on a
 * page of its own: bio, record in the promotion, and every OKTAGON fight
 * they have had - which is more than oktagonmma.com's own profile shows.
 *
 * The history is fetched when the sheet opens rather than shipped with the
 * fight card: ten cards on a phone would otherwise carry two hundred rows
 * nobody asked to see. */
export function FighterSheet({ fighter, onClose }: { fighter: Fighter; onClose: () => void }) {
  const supabase = createClient();
  const [history, setHistory] = useState<FighterHistoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("fighter_oktagon_fights")
        .select(
          `oktagon_fight_id, event_date, event_label, event_number, opponent_name,
           opponent_fighter_id, opponent_oktagon_fighter_id, opponent_slug, opponent_photo_url,
           outcome, result_type, end_round, end_time, title_fight, weight_class`
        )
        .eq("fighter_id", fighter.id)
        .order("event_date", { ascending: false });
      if (cancelled) return;
      if (error) {
        setFailed(true);
        return;
      }
      setHistory((data ?? []) as unknown as FighterHistoryEntry[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, fighter.id]);

  const record = history ? oktagonRecord(history) : null;
  const photo = fighter.photo_url ?? fighter.fight_card_photo_url;

  return (
    <Modal onClose={onClose}>
      <div className="flex items-start gap-3 pr-8">
        {photo && (
          <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
            <Image
              src={photo}
              alt={fighter.name}
              fill
              sizes="64px"
              className="object-cover object-top"
            />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-extrabold uppercase leading-tight tracking-tight">
            {fighter.flag_code && (
              <Image
                src={`https://flagcdn.com/h20/${fighter.flag_code}.png`}
                alt={fighter.nationality ?? ""}
                width={20}
                height={14}
                unoptimized
                className="h-auto w-5 shrink-0"
              />
            )}
            <span className="truncate">{fighter.name}</span>
          </h2>
          {fighter.nickname && (
            <p className="text-xs italic text-neutral-500 dark:text-neutral-400">
              {`„${fighter.nickname}“`}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
            {fighter.oktagon_rank && <span>{fighter.oktagon_rank}</span>}
            {fighter.record && (
              <span>
                Kariéra <span className="font-bold tabular-nums text-black dark:text-white">{fighter.record}</span>
              </span>
            )}
            {record && record.total > 0 && (
              <span>
                V OKTAGONU{" "}
                <span className="font-bold tabular-nums text-black dark:text-white">
                  {formatOktagonRecord(record)}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {history && history.length > 0 && <FighterForm form={recentForm(history)} />}

      {fighter.bio && (
        <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{fighter.bio}</p>
      )}

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Zápasy v OKTAGONU
        </h3>

        {history === null && !failed && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Načítám…</p>
        )}
        {failed && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Historii se nepodařilo načíst.
          </p>
        )}
        {history && history.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Tady zatím nic — buď je to jeho premiéra v OKTAGONU, nebo se historie ještě nestihla
            natáhnout.
          </p>
        )}

        {history && history.length > 0 && (
          <ul className="glass-surface divide-y divide-black/5 rounded-xl border dark:divide-white/5">
            {history.map((entry) => (
              <li
                key={entry.oktagon_fight_id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
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
                      OUTCOME_CHIPS[entry.outcome] ?? NEUTRAL_CHIP
                    )}
                  >
                    {OUTCOME_WORDS[entry.outcome] ?? "—"}
                  </span>
                  {/* For a draw or a no contest the chip above already is
                      the whole story - repeating the word under it read like
                      a rendering slip. */}
                  {(entry.outcome === "win" || entry.outcome === "loss") && (
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {describeHistoryResult(entry)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
