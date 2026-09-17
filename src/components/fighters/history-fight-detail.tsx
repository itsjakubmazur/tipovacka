"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FightMatchup } from "@/components/predictions/fight-matchup";
import { FightStatsPanel, hasAnyStats } from "@/components/fights/fight-stats-panel";
import { fightStatsFromRow, type FightStatsRow } from "@/lib/fight-stats-row";
import { describeHistoryResult } from "@/lib/fighter-history";
import type { Fight, FightStats, FighterHistoryEntry } from "@/lib/types";

const FIGHT_COLUMNS = `id, weight_class, is_title_fight, is_main_event, card_order, card_segment,
  rounds, status, winner_fighter_id, method, result_round, result_time,
  odds_fighter_a, odds_fighter_b,
  fighter_a:fighters!fights_fighter_a_id_fkey(id, oktagon_fighter_id, name, nickname, photo_url,
    fight_card_photo_url, bio, record, oktagon_rank, oktagon_rank_change, oktagon_slug, weight_kg,
    height_cm, birth_date, nationality, flag_code, is_tba),
  fighter_b:fighters!fights_fighter_b_id_fkey(id, oktagon_fighter_id, name, nickname, photo_url,
    fight_card_photo_url, bio, record, oktagon_rank, oktagon_rank_change, oktagon_slug, weight_kg,
    height_cm, birth_date, nationality, flag_code, is_tba)`;

/** One fight out of a fighter's record, opened in place.
 *
 * The card itself is the app's own: `FightMatchup` with no `onPick` is exactly
 * the graded header from a gala page - both cut-outs, the winner's chip, the
 * finish, the round and the clock - and `FightStatsPanel` is the same panel
 * that unfolds under a card there. Nothing here is a second rendering of a
 * fight; it is the rendering of a fight, with the tipping half left out
 * because there was never a tip to show.
 *
 * Fetched when it opens rather than with the page: a seventeen-fight record
 * would otherwise carry seventeen cards and seventeen sets of stats that
 * nobody asked to see. */
export function HistoryFightDetail({ entry }: { entry: FighterHistoryEntry }) {
  const supabase = createClient();
  const [fight, setFight] = useState<Fight | null>(null);
  const [stats, setStats] = useState<FightStats | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Wrapped rather than trusting the client to always resolve: a throw
      // here would leave "Načítám zápas…" on screen for good, and a row that
      // never stops loading is worse than one that says it has nothing.
      let data: unknown = null;
      let error: unknown = null;
      try {
        ({ data, error } = await supabase
          .from("fights")
          .select(FIGHT_COLUMNS)
          .eq("oktagon_fight_id", entry.oktagon_fight_id)
          .maybeSingle());
      } catch (exc) {
        error = exc;
      }
      if (cancelled) return;

      if (error || !data) {
        // Not every fight in a record is on a card we imported - the archive
        // skipped other promotions and empty listings. The row above still
        // said who, when and how it ended, so this is a gap, not a failure.
        setState("missing");
        return;
      }

      const row = data as unknown as Fight;
      setFight(row);
      setState("ready");

      // Stats are the optional half - a fight the tracking system never
      // covered still shows its card, so a failure here is not worth a state.
      try {
        const { data: statsRow } = await supabase
          .from("fight_stats")
          .select("*")
          .eq("fight_id", row.id)
          .maybeSingle();
        if (!cancelled && statsRow) {
          setStats(fightStatsFromRow(statsRow as unknown as FightStatsRow));
        }
      } catch {
        // ponecháme kartu bez statistik
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, entry.oktagon_fight_id]);

  const opponentLink = entry.opponent_fighter_id ? (
    <Link
      href={`/fighters/${entry.opponent_fighter_id}`}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-yellow-600 outline-none transition-colors hover:text-yellow-700 focus-visible:ring-2 focus-visible:ring-accent dark:text-accent dark:hover:text-yellow-300"
    >
      Profil: {entry.opponent_name}
      <ArrowRight className="size-4" />
    </Link>
  ) : null;

  if (state === "loading") {
    return (
      <div className="px-3 py-4 text-sm text-neutral-500 dark:text-neutral-400">Načítám zápas…</div>
    );
  }

  if (state === "missing" || !fight) {
    return (
      <div className="flex flex-col gap-3 px-3 py-4">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Tenhle zápas nemáme v kartě — {entry.event_label}, {describeHistoryResult(entry)}. Do
          archivu jsme brali jen turnaje OKTAGONU a FABRIQU.
        </p>
        {opponentLink}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-3">
      {/* no onPick: the photos are a picture of what happened, not a choice */}
      <FightMatchup
        fight={fight}
        eager
        tags={
          fight.winner_fighter_id
            ? [{ fighterId: fight.winner_fighter_id, label: "Vítěz", tone: "green" as const }]
            : []
        }
      />

      {hasAnyStats(stats ?? undefined) && <FightStatsPanel fight={fight} stats={stats!} />}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {[entry.event_label, fight.weight_class, entry.title_fight ? "o titul" : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {opponentLink}
      </div>
    </div>
  );
}
