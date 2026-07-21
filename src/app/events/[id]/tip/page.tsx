import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SwipeTipFlow } from "@/components/predictions/swipe-tip-flow";
import type { Fight, Prediction } from "@/lib/types";

/** Fast fight-by-fight tipping flow for an unlocked event - full-page
 * alternative to scrolling the card, sharing the same predictions
 * upsert. Locked/completed events bounce back to the event detail. */
export default async function SwipeTipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, status, lock_at")
    .eq("id", id)
    .single();

  if (!event || event.status === "draft") {
    notFound();
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const locked =
    event.status === "completed" ||
    (event.lock_at ? new Date(event.lock_at) <= new Date() : false);
  if (locked) {
    redirect(`/events/${id}`);
  }

  const { data: fights } = await supabase
    .from("fights")
    .select(
      `id, weight_class, is_title_fight, is_main_event, card_order, card_segment, rounds, status,
       winner_fighter_id, method, result_round, result_time, odds_fighter_a, odds_fighter_b,
       fighter_a:fighters!fights_fighter_a_id_fkey(id, name, nickname, photo_url, fight_card_photo_url, bio, record, oktagon_rank, oktagon_rank_change, oktagon_slug, weight_kg, height_cm, birth_date, nationality, flag_code, is_tba),
       fighter_b:fighters!fights_fighter_b_id_fkey(id, name, nickname, photo_url, fight_card_photo_url, bio, record, oktagon_rank, oktagon_rank_change, oktagon_slug, weight_kg, height_cm, birth_date, nationality, flag_code, is_tba)`
    )
    .eq("event_id", id)
    // ascending: tip the card in running order, main event as the finale
    .order("card_order", { ascending: true });

  const tippable = ((fights ?? []) as unknown as Fight[]).filter(
    (f) => f.status === "scheduled" && !f.fighter_a.is_tba && !f.fighter_b.is_tba
  );

  if (tippable.length === 0) {
    redirect(`/events/${id}`);
  }

  const { data: predictions } = await supabase
    .from("predictions")
    .select("fight_id, predicted_winner_id, predicted_method, predicted_round, points")
    .eq("user_id", user.id)
    .in(
      "fight_id",
      tippable.map((f) => f.id)
    );

  const predictionByFight: Record<string, Prediction> = Object.fromEntries(
    (predictions ?? []).map((p) => [p.fight_id, p])
  );

  return (
    <SwipeTipFlow
      eventId={id}
      userId={user.id}
      fights={tippable}
      initialPredictions={predictionByFight}
    />
  );
}
