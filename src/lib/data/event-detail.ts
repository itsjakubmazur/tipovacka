import { unstable_cache } from "next/cache";
import { createCachedClient } from "@/lib/supabase/cached";
import type { Fight } from "@/lib/types";

// 5 minutes is a safety-net TTL in case a webhook delivery is ever lost -
// revalidateTag (fired from supabase/migrations/20260741000000_revalidation_webhooks.sql
// via /api/internal/revalidate) is the primary invalidation path.
const SAFETY_NET_SECONDS = 300;

export type EventRow = {
  id: string;
  number: number | null;
  name: string;
  subtitle: string | null;
  event_date: string;
  location: string | null;
  status: string;
  lock_at: string | null;
  image_url: string | null;
  actual_fotn_fight_id: string | null;
  payouts_enabled: boolean;
};

export type CommentRow = {
  id: string;
  user_id: string | null;
  body: string;
  created_at: string;
  isSystem: boolean;
  gifUrl: string | null;
  nickname: string;
  reactions: { id: string; user_id: string; emoji: string }[];
};

export type FinalStandingRow = { user_id: string; nickname: string | null; points: number };

export type ConsensusPick = { fight_id: string; predicted_winner_id: string; profiles: { nickname: string } | null };

/** Everything about a gala that's identical for every viewer: the event
 * row, the fight card, comments, final standings (once graded) and
 * everyone's picks (once locked, for the consensus badges). Deliberately
 * excludes anything scoped to the logged-in user - see PersonalizedEventData
 * in the page component for that half. */
export function getEventShared(eventId: string) {
  return unstable_cache(
    async () => {
      const supabase = createCachedClient();

      const { data: event } = await supabase
        .from("events")
        .select(
          "id, number, name, subtitle, event_date, location, status, lock_at, image_url, actual_fotn_fight_id, payouts_enabled"
        )
        .eq("id", eventId)
        .single();

      if (!event) {
        return { event: null as EventRow | null, fights: [] as Fight[], comments: [] as CommentRow[], finalStandings: [] as FinalStandingRow[], allPredictions: [] as ConsensusPick[] };
      }

      const locked =
        event.status === "completed" ||
        (event.lock_at ? new Date(event.lock_at) <= new Date() : false);

      const [{ data: fights }, { data: rawComments }, { data: allPredictions }, { data: finalStandings }] =
        await Promise.all([
          supabase
            .from("fights")
            .select(
              `id, weight_class, is_title_fight, is_main_event, card_order, card_segment, rounds, status,
               winner_fighter_id, method, result_round, result_time, odds_fighter_a, odds_fighter_b,
               fighter_a:fighters!fights_fighter_a_id_fkey(id, name, nickname, photo_url, fight_card_photo_url, bio, record, oktagon_rank, oktagon_rank_change, oktagon_slug, weight_kg, height_cm, birth_date, nationality, flag_code, is_tba),
               fighter_b:fighters!fights_fighter_b_id_fkey(id, name, nickname, photo_url, fight_card_photo_url, bio, record, oktagon_rank, oktagon_rank_change, oktagon_slug, weight_kg, height_cm, birth_date, nationality, flag_code, is_tba)`
            )
            .eq("event_id", eventId)
            .order("card_order", { ascending: false }),
          supabase
            .from("event_comments")
            .select(
              "id, user_id, body, created_at, is_system, gif_url, profiles(nickname), event_comment_reactions(id, user_id, emoji)"
            )
            .eq("event_id", eventId)
            .order("created_at", { ascending: false })
            .limit(100),
          locked
            ? supabase
                .from("predictions")
                .select("fight_id, predicted_winner_id, profiles(nickname), fights!inner(event_id)")
                .eq("fights.event_id", eventId)
            : Promise.resolve({ data: null as ConsensusPick[] | null }),
          event.status === "completed"
            ? supabase
                .from("event_leaderboard")
                .select("user_id, nickname, points")
                .eq("event_id", eventId)
                .order("points", { ascending: false })
                .order("fights_correct_winner", { ascending: false })
                .order("perfect_card", { ascending: false })
                .order("earliest_prediction_at", { ascending: true, nullsFirst: false })
            : Promise.resolve({ data: null as FinalStandingRow[] | null }),
        ]);

      const comments: CommentRow[] = (
        (rawComments ?? []) as unknown as {
          id: string;
          user_id: string | null;
          body: string;
          created_at: string;
          is_system: boolean;
          gif_url: string | null;
          profiles: { nickname: string } | null;
          event_comment_reactions: { id: string; user_id: string; emoji: string }[];
        }[]
      ).map((c) => ({
        id: c.id,
        user_id: c.user_id,
        body: c.body,
        created_at: c.created_at,
        isSystem: c.is_system,
        gifUrl: c.gif_url,
        nickname: c.profiles?.nickname ?? "Bez přezdívky",
        reactions: c.event_comment_reactions,
      }));

      return {
        event: event as EventRow,
        fights: (fights ?? []) as unknown as Fight[],
        comments,
        finalStandings: finalStandings ?? [],
        allPredictions: (allPredictions ?? []) as unknown as ConsensusPick[],
      };
    },
    ["event-shared", eventId],
    { tags: [`event-${eventId}`], revalidate: SAFETY_NET_SECONDS }
  )();
}
