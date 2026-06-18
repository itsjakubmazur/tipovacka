import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FightTipCard } from "@/components/predictions/fight-tip-card";
import type { Fight, Prediction } from "@/lib/types";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, number, name, event_date, location, status, lock_at")
    .eq("id", id)
    .single();

  if (!event) {
    notFound();
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const { data: fights } = await supabase
    .from("fights")
    .select(
      `id, weight_class, is_title_fight, is_main_event, card_order, rounds, status,
       winner_fighter_id, method, result_round,
       fighter_a:fighters!fights_fighter_a_id_fkey(id, name, nickname, photo_url, record, fightmatrix_rank, fightmatrix_score),
       fighter_b:fighters!fights_fighter_b_id_fkey(id, name, nickname, photo_url, record, fightmatrix_rank, fightmatrix_score)`
    )
    .eq("event_id", id)
    .order("card_order", { ascending: false });

  const fightIds = (fights ?? []).map((f) => f.id);

  const { data: predictions } = await supabase
    .from("predictions")
    .select("fight_id, predicted_winner_id, predicted_method, predicted_round, points")
    .eq("user_id", user.id)
    .in("fight_id", fightIds.length ? fightIds : ["00000000-0000-0000-0000-000000000000"]);

  const predictionByFight = new Map<string, Prediction>(
    (predictions ?? []).map((p) => [p.fight_id, p])
  );

  const locked =
    event.status === "completed" ||
    (event.lock_at ? new Date(event.lock_at) <= new Date() : false);

  return (
    <div className="flex flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold">
          {event.number ? `OKTAGON ${event.number}` : event.name}
        </h1>
        <p className="text-sm text-neutral-600">{event.location}</p>
        <p className="text-sm text-neutral-500">
          {new Date(event.event_date).toLocaleString("cs-CZ", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "Europe/Prague",
          })}
        </p>
        {locked && (
          <p className="mt-2 text-sm font-medium text-neutral-700">
            Tipy jsou uzamčené, jen pro čtení.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {(fights ?? []).map((fight) => (
          <FightTipCard
            key={fight.id}
            fight={fight as unknown as Fight}
            userId={user.id}
            initialPrediction={predictionByFight.get(fight.id) ?? null}
            locked={locked}
          />
        ))}
      </div>
    </div>
  );
}
