import { Fragment } from "react";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FightTipCard } from "@/components/predictions/fight-tip-card";
import { FotnPicker } from "@/components/predictions/fotn-picker";
import { DigitalCountdown } from "@/components/digital-countdown";
import type { Fight, Prediction } from "@/lib/types";

const CARD_SEGMENT_LABELS: Record<NonNullable<Fight["card_segment"]>, string> = {
  main_card: "Hlavní karta",
  prelims: "Prelims",
  free_prelims: "Free Prelims",
};

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, number, name, event_date, location, status, lock_at, image_url, actual_fotn_fight_id")
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

  if (event.status === "draft") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) {
      notFound();
    }
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

  const fotnOptions = (fights ?? []).map((rawFight) => {
    const fight = rawFight as unknown as Fight;
    return {
      id: fight.id,
      fighterAName: fight.fighter_a.name,
      fighterBName: fight.fighter_b.name,
    };
  });

  const actualFotnFight = (fights ?? [])
    .map((f) => f as unknown as Fight)
    .find((f) => f.id === event.actual_fotn_fight_id);

  const { data: bonusPrediction } = await supabase
    .from("bonus_predictions")
    .select("predicted_fotn_fight_id, points")
    .eq("user_id", user.id)
    .eq("event_id", id)
    .maybeSingle();

  const { rows: fightsWithHeaders } = (fights ?? []).reduce<{
    rows: { fight: Fight; showSegmentHeader: boolean }[];
    lastSegment: Fight["card_segment"];
  }>(
    (acc, rawFight) => {
      const fight = rawFight as unknown as Fight;
      // Cancelled fights replaced by an opponent swap can predate the
      // card_segment column and carry a null value - skip over them
      // instead of resetting the segment, so they don't reprint the
      // header for the segment that's still ongoing.
      const showSegmentHeader = Boolean(fight.card_segment && fight.card_segment !== acc.lastSegment);
      return {
        rows: [...acc.rows, { fight, showSegmentHeader }],
        lastSegment: fight.card_segment ?? acc.lastSegment,
      };
    },
    { rows: [], lastSegment: null }
  );

  const consensusByFight = new Map<string, Map<string, number>>();
  if (locked && fightIds.length) {
    const { data: allPredictions } = await supabase
      .from("predictions")
      .select("fight_id, predicted_winner_id")
      .in("fight_id", fightIds);
    for (const p of allPredictions ?? []) {
      const counts = consensusByFight.get(p.fight_id) ?? new Map<string, number>();
      counts.set(p.predicted_winner_id, (counts.get(p.predicted_winner_id) ?? 0) + 1);
      consensusByFight.set(p.fight_id, counts);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-8">
      {event.image_url && (
        <div className="relative -mx-4 -mt-8 aspect-[16/9] overflow-hidden sm:mx-0 sm:mt-0 sm:rounded-xl">
          <Image
            src={event.image_url}
            alt={event.number ? `OKTAGON ${event.number}` : event.name}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-background" />
        </div>
      )}
      <div>
        <h1 className="text-xl font-bold">
          {event.number ? `OKTAGON ${event.number}` : event.name}
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{event.location}</p>
        <p className="text-sm text-neutral-500 dark:text-neutral-300">
          {new Date(event.event_date).toLocaleString("cs-CZ", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "Europe/Prague",
          })}
        </p>
        {locked ? (
          <p className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Tipy jsou uzamčené, jen pro čtení.
          </p>
        ) : (
          event.lock_at && (
            <div className="mt-3">
              <DigitalCountdown lockAt={event.lock_at} />
            </div>
          )
        )}
        {!locked && fightIds.length > 0 && (
          <span className="mt-2 inline-flex items-center rounded-full border border-white/45 bg-white/35 backdrop-blur-lg px-3 py-1 text-xs font-medium text-black dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:text-white">
            Tipnuto {predictions?.length ?? 0} z {fightIds.length} zápasů
          </span>
        )}
      </div>

      <FotnPicker
        eventId={id}
        userId={user.id}
        fights={fotnOptions}
        initialFightId={bonusPrediction?.predicted_fotn_fight_id ?? null}
        initialPoints={bonusPrediction?.points ?? null}
        locked={locked}
        actualFight={
          actualFotnFight
            ? { fighterAName: actualFotnFight.fighter_a.name, fighterBName: actualFotnFight.fighter_b.name }
            : null
        }
      />

      <div className="flex flex-col gap-5">
        {fightsWithHeaders.map(({ fight, showSegmentHeader }) => {
          const counts = consensusByFight.get(fight.id);
          const total = counts ? Array.from(counts.values()).reduce((a, b) => a + b, 0) : 0;
          return (
            <Fragment key={fight.id}>
              {showSegmentHeader && (
                <h2 className="-mb-1 text-sm font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {CARD_SEGMENT_LABELS[fight.card_segment!]}
                </h2>
              )}
              <FightTipCard
                fight={fight}
                userId={user.id}
                initialPrediction={predictionByFight.get(fight.id) ?? null}
                locked={locked}
                consensus={
                  total > 0
                    ? {
                        fighterACount: counts?.get(fight.fighter_a.id) ?? 0,
                        fighterBCount: counts?.get(fight.fighter_b.id) ?? 0,
                        total,
                      }
                    : undefined
                }
              />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
