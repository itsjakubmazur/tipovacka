import { createClient } from "@/lib/supabase/client";
import type { Method } from "@/lib/types";

/** Do not send unspecified columns as null. PostgREST would otherwise try to
 * write `points` (and wipe a graded row on upsert). The database also no
 * longer GRANTs client writes to that column. */
const UPSERT_WITHOUT_NULLS = { defaultToNull: false } as const;

/** Single write path for a fight tip. The card and the fast-tip overlay
 * used to duplicate this upsert; keeping it here means neither can start
 * sending `points`. */
export async function persistTip(input: {
  userId: string;
  fightId: string;
  winnerId: string;
  method: Method;
  round: number | null;
}) {
  const supabase = createClient();
  return supabase.from("predictions").upsert(
    {
      user_id: input.userId,
      fight_id: input.fightId,
      predicted_winner_id: input.winnerId,
      predicted_method: input.method,
      predicted_round: input.method === "DECISION" ? null : input.round,
    },
    { onConflict: "user_id,fight_id", ...UPSERT_WITHOUT_NULLS }
  );
}

export async function persistFotnTip(input: {
  userId: string;
  eventId: string;
  fightId: string;
}) {
  const supabase = createClient();
  return supabase.from("bonus_predictions").upsert(
    {
      user_id: input.userId,
      event_id: input.eventId,
      predicted_fotn_fight_id: input.fightId,
    },
    { onConflict: "user_id,event_id", ...UPSERT_WITHOUT_NULLS }
  );
}
