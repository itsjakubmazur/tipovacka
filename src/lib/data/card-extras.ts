import { unstable_cache } from "next/cache";
import { createCachedClient } from "@/lib/supabase/cached";
import { findPreviousMeeting, oktagonRecord, recentForm } from "@/lib/fighter-history";
import type {
  Fight,
  FighterHistoryEntry,
  FightStats,
  FightStatsSide,
} from "@/lib/types";
import type { OktagonRecord } from "@/lib/fighter-history";

const SAFETY_NET_SECONDS = 300;

export type FighterCardSummary = {
  record: OktagonRecord;
  /** newest first, at most five - the W/L run under the bio */
  form: FighterHistoryEntry[];
};

export type PreviousMeeting = {
  /** the fighter whose history this was found in */
  fighterId: string;
  entry: FighterHistoryEntry;
};

export type CardExtras = {
  /** keyed by our `fighters.id` */
  historyByFighter: Record<string, FighterCardSummary>;
  /** keyed by `fights.id` - only for pairs who have already met */
  previousMeetingByFight: Record<string, PreviousMeeting>;
  /** keyed by `fights.id` - only where the tracking system has anything */
  statsByFight: Record<string, FightStats>;
};

const EMPTY: CardExtras = { historyByFighter: {}, previousMeetingByFight: {}, statsByFight: {} };

type StatsRow = {
  fight_id: string;
  rounds: FightStats["rounds"];
} & Record<string, number | string | FightStats["rounds"]>;

function side(row: StatsRow, prefix: "fighter_a" | "fighter_b"): FightStatsSide {
  return {
    hits: Number(row[`${prefix}_hits`] ?? 0),
    significant_hits: Number(row[`${prefix}_significant_hits`] ?? 0),
    takedowns: Number(row[`${prefix}_takedowns`] ?? 0),
    takedown_attempts: Number(row[`${prefix}_takedown_attempts`] ?? 0),
    submission_attempts: Number(row[`${prefix}_submission_attempts`] ?? 0),
  };
}

/** Everything the fight card shows *about the fighters* rather than about the
 * tipping: their record in the promotion, their recent form, whether these two
 * have met before, and - once a fight is over - what the tracking system
 * logged.
 *
 * Cached against the event *and* every fighter on it, because the two are
 * invalidated by different writes: re-importing the card busts `event-<id>`,
 * while the history importer busts `fighter-<id>` for whoever it refreshed
 * (see supabase/migrations/20260745000000_fighter_history_and_fight_stats.sql). */
export function getCardExtras(eventId: string, eventDate: string, fights: Fight[]) {
  const fighterIds = Array.from(
    new Set(fights.flatMap((f) => [f.fighter_a.id, f.fighter_b.id]))
  ).sort();

  if (fighterIds.length === 0) {
    return Promise.resolve(EMPTY);
  }

  return unstable_cache(
    async (): Promise<CardExtras> => {
      const supabase = createCachedClient();

      const [{ data: history }, { data: stats }] = await Promise.all([
        supabase
          .from("fighter_oktagon_fights")
          .select(
            `fighter_id, oktagon_fight_id, event_date, event_label, event_number, opponent_name,
             opponent_fighter_id, opponent_oktagon_fighter_id, opponent_slug, opponent_photo_url,
             outcome, result_type, end_round, end_time, title_fight, weight_class`
          )
          .in("fighter_id", fighterIds)
          .order("event_date", { ascending: false }),
        supabase
          .from("fight_stats")
          .select("*")
          .in(
            "fight_id",
            fights.map((f) => f.id)
          ),
      ]);

      const byFighter = new Map<string, FighterHistoryEntry[]>();
      for (const row of (history ?? []) as unknown as (FighterHistoryEntry & {
        fighter_id: string;
      })[]) {
        const { fighter_id: fighterId, ...entry } = row;
        const list = byFighter.get(fighterId);
        if (list) list.push(entry);
        else byFighter.set(fighterId, [entry]);
      }

      const historyByFighter: CardExtras["historyByFighter"] = {};
      for (const [fighterId, entries] of byFighter) {
        historyByFighter[fighterId] = {
          record: oktagonRecord(entries),
          form: recentForm(entries),
        };
      }

      const previousMeetingByFight: CardExtras["previousMeetingByFight"] = {};
      for (const fight of fights) {
        // Looking it up from one side is enough - the same bout is in both
        // fighters' history, and the a-side phrasing is what the badge uses.
        const entry = findPreviousMeeting(
          byFighter.get(fight.fighter_a.id) ?? [],
          fight.fighter_b.oktagon_fighter_id,
          eventDate
        );
        if (entry) {
          previousMeetingByFight[fight.id] = { fighterId: fight.fighter_a.id, entry };
        }
      }

      const statsByFight: CardExtras["statsByFight"] = {};
      for (const row of (stats ?? []) as unknown as StatsRow[]) {
        statsByFight[row.fight_id] = {
          fight_id: row.fight_id,
          a: side(row, "fighter_a"),
          b: side(row, "fighter_b"),
          rounds: Array.isArray(row.rounds) ? row.rounds : [],
        };
      }

      return { historyByFighter, previousMeetingByFight, statsByFight };
    },
    ["card-extras", eventId, eventDate, fighterIds.join(",")],
    {
      tags: [`event-${eventId}`, ...fighterIds.map((id) => `fighter-${id}`)],
      revalidate: SAFETY_NET_SECONDS,
    }
  )();
}
