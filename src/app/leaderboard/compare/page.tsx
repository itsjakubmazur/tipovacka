import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { CompareFightCard } from "@/components/leaderboard/compare-fight-card";
import type { Fight, Prediction } from "@/lib/types";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string; season?: string; eventId?: string }>;
}) {
  const { a, b, season: rawSeason, eventId } = await searchParams;
  if (!a || !b) notFound();

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, nickname")
    .in("id", [a, b]);

  if (profilesError) {
    return (
      <div className="flex flex-col gap-4 px-4 py-8">
        <Link href="/leaderboard" className="text-sm text-neutral-500 dark:text-neutral-300 hover:text-black dark:hover:text-white">
          ← Zpět na žebříček
        </Link>
        <p className="text-sm text-red-600">Chyba při načítání porovnání: {profilesError.message}</p>
      </div>
    );
  }

  const profileA = profiles?.find((p) => p.id === a);
  const profileB = profiles?.find((p) => p.id === b);
  if (!profileA || !profileB) notFound();

  const nicknameA = profileA.nickname ?? "Bez přezdívky";
  const nicknameB = profileB.nickname ?? "Bez přezdívky";

  if (eventId) {
    const { data: event } = await supabase
      .from("events")
      .select("id, number, name, actual_fotn_fight_id")
      .eq("id", eventId)
      .neq("status", "draft")
      .single();

    if (!event) notFound();

    const { data: fights } = await supabase
      .from("fights")
      .select(
        `id, weight_class, is_title_fight, is_main_event, card_order, rounds, status,
         winner_fighter_id, method, result_round, result_time, odds_fighter_a, odds_fighter_b,
         fighter_a:fighters!fights_fighter_a_id_fkey(id, name, nickname, photo_url, fight_card_photo_url, bio, record, oktagon_rank, oktagon_rank_change, oktagon_slug, weight_kg, height_cm, birth_date, nationality, flag_code),
         fighter_b:fighters!fights_fighter_b_id_fkey(id, name, nickname, photo_url, fight_card_photo_url, bio, record, oktagon_rank, oktagon_rank_change, oktagon_slug, weight_kg, height_cm, birth_date, nationality, flag_code)`
      )
      .eq("event_id", eventId)
      .order("card_order", { ascending: false });

    const fightIds = (fights ?? []).map((f) => f.id);

    const [{ data: predictions }, { data: bonusPredictions }, { data: leaderboardRows }] = await Promise.all([
      supabase
        .from("predictions")
        .select("fight_id, user_id, predicted_winner_id, predicted_method, predicted_round, points")
        .in("user_id", [a, b])
        .in("fight_id", fightIds.length ? fightIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase
        .from("bonus_predictions")
        .select("user_id, predicted_fotn_fight_id, points")
        .eq("event_id", eventId)
        .in("user_id", [a, b]),
      supabase
        .from("event_leaderboard")
        .select("user_id, points")
        .eq("event_id", eventId)
        .in("user_id", [a, b]),
    ]);

    const predictionByFight = new Map<string, { a: Prediction | null; b: Prediction | null }>();
    for (const fightId of fightIds) {
      predictionByFight.set(fightId, { a: null, b: null });
    }
    for (const p of predictions ?? []) {
      const entry = predictionByFight.get(p.fight_id);
      if (!entry) continue;
      if (p.user_id === a) entry.a = p;
      else entry.b = p;
    }

    const bonusA = (bonusPredictions ?? []).find((bp) => bp.user_id === a) ?? null;
    const bonusB = (bonusPredictions ?? []).find((bp) => bp.user_id === b) ?? null;
    const fightById = new Map((fights ?? []).map((f) => [f.id, f]));
    const bonusFightA = bonusA ? fightById.get(bonusA.predicted_fotn_fight_id) : null;
    const bonusFightB = bonusB ? fightById.get(bonusB.predicted_fotn_fight_id) : null;
    const actualFotnFight = event.actual_fotn_fight_id ? fightById.get(event.actual_fotn_fight_id) : null;

    const totalA = (leaderboardRows ?? []).find((r) => r.user_id === a)?.points ?? 0;
    const totalB = (leaderboardRows ?? []).find((r) => r.user_id === b)?.points ?? 0;

    return (
      <div className="flex flex-col gap-4 px-4 py-8">
        <Link href={`/leaderboard?view=event&eventId=${eventId}`} className="text-sm text-neutral-500 dark:text-neutral-300 hover:text-black dark:hover:text-white">
          ← Zpět na žebříček
        </Link>

        <h1 className="text-xl font-bold">
          {nicknameA} vs {nicknameB}
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {event.number ? `OKTAGON ${event.number}` : event.name}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center gap-1 rounded-xl border border-white/60 bg-white/55 backdrop-blur-md p-4 shadow-lg shadow-black/20 dark:border-neutral-700/60 dark:bg-neutral-800/55 dark:shadow-black/60">
            <span className="font-semibold text-[#FFD400]">{nicknameA}</span>
            <span className="text-2xl font-bold">{totalA}</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl border border-white/60 bg-white/55 backdrop-blur-md p-4 shadow-lg shadow-black/20 dark:border-neutral-700/60 dark:bg-neutral-800/55 dark:shadow-black/60">
            <span className="font-semibold text-blue-500">{nicknameB}</span>
            <span className="text-2xl font-bold">{totalB}</span>
          </div>
        </div>

        {(bonusFightA || bonusFightB || actualFotnFight) && (
          <div className="rounded-xl border border-white/60 bg-white/55 backdrop-blur-md p-4 text-sm shadow-lg shadow-black/20 dark:border-neutral-700/60 dark:bg-neutral-800/55 dark:shadow-black/60">
            <p className="font-semibold">🥊 Bonus tip: Fight of the Night</p>
            <p className="text-[#FFD400]">
              {nicknameA}:{" "}
              {bonusFightA ? (
                <span className="text-neutral-700 dark:text-neutral-300">
                  {(bonusFightA as unknown as Fight).fighter_a.name} vs {(bonusFightA as unknown as Fight).fighter_b.name}
                  {bonusA?.points != null && (
                    <span className="ml-2 font-semibold">
                      {bonusA.points > 0 ? `Trefeno! +${bonusA.points} b.` : "Netrefeno."}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-neutral-400">bez tipu</span>
              )}
            </p>
            <p className="text-blue-500">
              {nicknameB}:{" "}
              {bonusFightB ? (
                <span className="text-neutral-700 dark:text-neutral-300">
                  {(bonusFightB as unknown as Fight).fighter_a.name} vs {(bonusFightB as unknown as Fight).fighter_b.name}
                  {bonusB?.points != null && (
                    <span className="ml-2 font-semibold">
                      {bonusB.points > 0 ? `Trefeno! +${bonusB.points} b.` : "Netrefeno."}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-neutral-400">bez tipu</span>
              )}
            </p>
            {actualFotnFight && (
              <p className="mt-1 text-xs font-medium">
                🏆 Skutečný Fight of the Night:{" "}
                <span className="text-[#FFD400]">
                  {(actualFotnFight as unknown as Fight).fighter_a.name} vs {(actualFotnFight as unknown as Fight).fighter_b.name}
                </span>
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {(fights ?? []).map((fight) => {
            const entry = predictionByFight.get(fight.id);
            return (
              <CompareFightCard
                key={fight.id}
                fight={fight as unknown as Fight}
                predictionA={entry?.a ?? null}
                predictionB={entry?.b ?? null}
                nicknameA={nicknameA}
                nicknameB={nicknameB}
              />
            );
          })}
        </div>
      </div>
    );
  }

  const season = rawSeason ? Number(rawSeason) : new Date().getFullYear();

  const { data: events } = await supabase
    .from("events")
    .select("id, number, name, event_date")
    .neq("status", "draft")
    .order("event_date", { ascending: false });

  const eventsInSeason = (events ?? []).filter(
    (e) => new Date(e.event_date).getFullYear() === season
  );
  const eventIds = eventsInSeason.map((e) => e.id);

  const { data: rows } = await supabase
    .from("event_leaderboard")
    .select("event_id, user_id, points, perfect_card")
    .in("user_id", [a, b])
    .in("event_id", eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"]);

  const pointsByEvent = new Map<string, { a: number | null; b: number | null }>();
  for (const event of eventsInSeason) {
    pointsByEvent.set(event.id, { a: null, b: null });
  }
  let perfectCardsA = 0;
  let perfectCardsB = 0;
  for (const row of rows ?? []) {
    const entry = pointsByEvent.get(row.event_id);
    if (!entry) continue;
    if (row.user_id === a) {
      entry.a = row.points;
      if (row.perfect_card) perfectCardsA++;
    } else {
      entry.b = row.points;
      if (row.perfect_card) perfectCardsB++;
    }
  }

  let winsA = 0;
  let winsB = 0;
  let ties = 0;
  let totalA = 0;
  let totalB = 0;
  for (const event of eventsInSeason) {
    const entry = pointsByEvent.get(event.id)!;
    if (entry.a == null && entry.b == null) continue;
    const pa = entry.a ?? 0;
    const pb = entry.b ?? 0;
    totalA += pa;
    totalB += pb;
    if (pa > pb) winsA++;
    else if (pb > pa) winsB++;
    else ties++;
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-8">
      <Link href={`/leaderboard?view=season`} className="text-sm text-neutral-500 dark:text-neutral-300 hover:text-black dark:hover:text-white">
        ← Zpět na žebříček
      </Link>

      <h1 className="text-xl font-bold">
        {nicknameA} vs {nicknameB}
      </h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">Sezóna {season}</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center gap-1 rounded-xl border border-white/60 bg-white/55 backdrop-blur-md p-4 shadow-lg shadow-black/20 dark:border-neutral-700/60 dark:bg-neutral-800/55 dark:shadow-black/60">
          <span className="font-semibold">{nicknameA}</span>
          <span className="text-2xl font-bold">{totalA}</span>
          <span className="text-xs text-neutral-500 dark:text-neutral-300">{winsA}× lepší večer</span>
          {perfectCardsA > 0 && (
            <span className="text-xs text-neutral-500 dark:text-neutral-300">🏆 {perfectCardsA}× perfektní karta</span>
          )}
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl border border-white/60 bg-white/55 backdrop-blur-md p-4 shadow-lg shadow-black/20 dark:border-neutral-700/60 dark:bg-neutral-800/55 dark:shadow-black/60">
          <span className="font-semibold">{nicknameB}</span>
          <span className="text-2xl font-bold">{totalB}</span>
          <span className="text-xs text-neutral-500 dark:text-neutral-300">{winsB}× lepší večer</span>
          {perfectCardsB > 0 && (
            <span className="text-xs text-neutral-500 dark:text-neutral-300">🏆 {perfectCardsB}× perfektní karta</span>
          )}
        </div>
      </div>

      {ties > 0 && (
        <p className="text-center text-xs text-neutral-500 dark:text-neutral-300">{ties}× shodný počet bodů</p>
      )}

      <div className="flex flex-col gap-2">
        {eventsInSeason.map((event) => {
          const entry = pointsByEvent.get(event.id)!;
          if (entry.a == null && entry.b == null) return null;
          const pa = entry.a ?? 0;
          const pb = entry.b ?? 0;
          return (
            <div
              key={event.id}
              className="flex items-center justify-between rounded-xl border border-white/60 bg-white/55 backdrop-blur-md p-3 text-sm shadow-lg shadow-black/20 dark:border-neutral-700/60 dark:bg-neutral-800/55 dark:shadow-black/60"
            >
              <span className={cn("w-12 text-right font-bold", pa > pb && "text-[#FFD400]")}>{pa}</span>
              <span className="flex-1 px-3 text-center text-neutral-600 dark:text-neutral-400">
                {event.number ? `OKTAGON ${event.number}` : event.name}
              </span>
              <span className={cn("w-12 font-bold", pb > pa && "text-[#FFD400]")}>{pb}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
