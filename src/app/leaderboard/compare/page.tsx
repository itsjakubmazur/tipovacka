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
      .select("id, number, name")
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

    const { data: predictions } = await supabase
      .from("predictions")
      .select("fight_id, user_id, predicted_winner_id, predicted_method, predicted_round, points")
      .in("user_id", [a, b])
      .in("fight_id", fightIds.length ? fightIds : ["00000000-0000-0000-0000-000000000000"]);

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

    const totalA = (predictions ?? []).filter((p) => p.user_id === a).reduce((sum, p) => sum + (p.points ?? 0), 0);
    const totalB = (predictions ?? []).filter((p) => p.user_id === b).reduce((sum, p) => sum + (p.points ?? 0), 0);

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
          <div className="flex flex-col items-center gap-1 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
            <span className="font-semibold text-[#FFD400]">{nicknameA}</span>
            <span className="text-2xl font-bold">{totalA}</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
            <span className="font-semibold text-blue-500">{nicknameB}</span>
            <span className="text-2xl font-bold">{totalB}</span>
          </div>
        </div>

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
        <div className="flex flex-col items-center gap-1 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
          <span className="font-semibold">{nicknameA}</span>
          <span className="text-2xl font-bold">{totalA}</span>
          <span className="text-xs text-neutral-500 dark:text-neutral-300">{winsA}× lepší večer</span>
          {perfectCardsA > 0 && (
            <span className="text-xs text-neutral-500 dark:text-neutral-300">🏆 {perfectCardsA}× perfektní karta</span>
          )}
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
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
              className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 text-sm"
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
