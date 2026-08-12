import { unstable_cache } from "next/cache";
import { createCachedClient } from "@/lib/supabase/cached";
import { METHOD_LABELS } from "@/lib/method-labels";
import type { Method } from "@/lib/types";

// 5 minutes is a safety-net TTL in case a webhook delivery is ever lost -
// revalidateTag (fired from supabase/migrations/20260741000000_revalidation_webhooks.sql
// via /api/internal/revalidate) is the primary invalidation path.
const SAFETY_NET_SECONDS = 300;

export type EventLeaderboardRow = {
  user_id: string;
  nickname: string | null;
  points: number;
  fights_scored: number;
  fights_completed: number;
  perfect_card: boolean;
  fights_correct_winner: number;
  earliest_prediction_at: string | null;
};

export type SeasonLeaderboardRow = {
  user_id: string;
  nickname: string | null;
  points: number;
  fights_correct_winner: number;
  perfect_cards: number;
  earliest_prediction_at: string | null;
  events_played: number;
};

export type ReplayStep = {
  fightId: string;
  label: string;
  result: string;
  gains: Record<string, number>;
};

export type LeaderboardEvent = {
  id: string;
  number: number | null;
  name: string;
  event_date: string;
  status: string;
  lock_at: string | null;
  image_url: string | null;
};

/** Non-draft events for the gala switcher, shared across every viewer. */
export const getLeaderboardEvents = unstable_cache(
  async (): Promise<LeaderboardEvent[]> => {
    const supabase = createCachedClient();
    const { data } = await supabase
      .from("events")
      .select("id, number, name, event_date, status, lock_at, image_url")
      .neq("status", "draft")
      .order("event_date", { ascending: false });
    return data ?? [];
  },
  ["leaderboard-events"],
  { tags: ["leaderboard-global"], revalidate: SAFETY_NET_SECONDS }
);

/** One event's standings + fight-by-fight replay, shared across every viewer. */
export function getEventLeaderboard(eventId: string, previousEventId: string | null, completed: boolean) {
  return unstable_cache(
    async () => {
      const supabase = createCachedClient();

      const [{ data: rows }, { count }, prevResult] = await Promise.all([
        supabase
          .from("event_leaderboard")
          .select(
            "user_id, nickname, points, fights_scored, fights_completed, perfect_card, fights_correct_winner, earliest_prediction_at"
          )
          .eq("event_id", eventId)
          .order("points", { ascending: false })
          .order("fights_correct_winner", { ascending: false })
          .order("perfect_card", { ascending: false })
          .order("earliest_prediction_at", { ascending: true, nullsFirst: false }),
        supabase
          .from("fights")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId)
          .not("status", "in", "(cancelled,no_contest)"),
        previousEventId
          ? supabase
              .from("event_leaderboard")
              .select("user_id, points")
              .eq("event_id", previousEventId)
              .order("points", { ascending: false })
          : Promise.resolve({ data: null as { user_id: string }[] | null }),
      ]);

      const eventRows = (rows ?? []) as EventLeaderboardRow[];
      const prevRankByUser: Record<string, number> = {};
      (prevResult.data ?? []).forEach((row, i) => {
        prevRankByUser[row.user_id] = i + 1;
      });

      let replaySteps: ReplayStep[] = [];
      if (completed) {
        const [{ data: replayFights }, { data: replayPicks }, { data: replayBold }] = await Promise.all([
          supabase
            .from("fights")
            .select(
              `id, card_order, status, winner_fighter_id, method, result_round,
               fighter_a:fighters!fights_fighter_a_id_fkey(name),
               fighter_b:fighters!fights_fighter_b_id_fkey(name)`
            )
            .eq("event_id", eventId)
            .eq("status", "completed")
            .order("card_order", { ascending: true }),
          supabase
            .from("predictions")
            .select("user_id, fight_id, points, fights!inner(event_id)")
            .eq("fights.event_id", eventId),
          supabase.from("bold_picks").select("user_id, fight_id").eq("event_id", eventId),
        ]);

        const boldByUser = new Map(
          (replayBold ?? []).map((b: { user_id: string; fight_id: string }) => [b.user_id, b.fight_id])
        );
        const picks = (replayPicks ?? []) as unknown as {
          user_id: string;
          fight_id: string;
          points: number | null;
        }[];

        replaySteps = (
          (replayFights ?? []) as unknown as {
            id: string;
            winner_fighter_id: string | null;
            method: string | null;
            result_round: number | null;
            fighter_a: { name: string };
            fighter_b: { name: string };
          }[]
        ).map((fight) => {
          const gains: Record<string, number> = {};
          for (const p of picks) {
            if (p.fight_id !== fight.id || !p.points) continue;
            gains[p.user_id] = p.points * (boldByUser.get(p.user_id) === fight.id ? 2 : 1);
          }
          return {
            fightId: fight.id,
            label: `${fight.fighter_a.name} vs ${fight.fighter_b.name}`,
            result: [
              fight.winner_fighter_id ? "" : "bez vítěze",
              fight.method ? METHOD_LABELS[fight.method as Method] : "",
              fight.result_round ? `${fight.result_round}. kolo` : "",
            ]
              .filter(Boolean)
              .join(" · "),
            gains,
          };
        });
      }

      return { eventRows, totalFights: count ?? 0, prevRankByUser, replaySteps };
    },
    ["event-leaderboard", eventId, previousEventId ?? "none", String(completed)],
    { tags: [`leaderboard-event-${eventId}`], revalidate: SAFETY_NET_SECONDS }
  )();
}

/** One season's standings, shared across every viewer. */
export function getSeasonLeaderboard(season: number) {
  return unstable_cache(
    async (): Promise<SeasonLeaderboardRow[]> => {
      const supabase = createCachedClient();
      const { data } = await supabase
        .from("season_leaderboard")
        .select(
          "user_id, nickname, points, fights_correct_winner, perfect_cards, earliest_prediction_at, events_played"
        )
        .eq("season", season)
        .order("points", { ascending: false })
        .order("fights_correct_winner", { ascending: false })
        .order("perfect_cards", { ascending: false })
        .order("earliest_prediction_at", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
    ["season-leaderboard", String(season)],
    { tags: ["leaderboard-global"], revalidate: SAFETY_NET_SECONDS }
  )();
}

type HallOfFameRow = {
  season: number;
  user_id: string;
  nickname: string | null;
  points: number;
  perfect_cards: number;
};

/** Per-season podium across every season, zero personalization. */
export const getHallOfFameData = unstable_cache(
  async (): Promise<HallOfFameRow[]> => {
    const supabase = createCachedClient();
    const { data } = await supabase
      .from("season_leaderboard")
      .select("season, user_id, nickname, points, fights_correct_winner, perfect_cards, earliest_prediction_at")
      .order("season", { ascending: false })
      .order("points", { ascending: false })
      .order("fights_correct_winner", { ascending: false })
      .order("perfect_cards", { ascending: false })
      .order("earliest_prediction_at", { ascending: true, nullsFirst: false });
    return (data ?? []) as HallOfFameRow[];
  },
  ["hall-of-fame"],
  { tags: ["hall-of-fame"], revalidate: SAFETY_NET_SECONDS }
);
