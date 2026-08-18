import { Swords, Trophy } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { COMPARE_B_TEXT } from "@/lib/compare-tone";
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
      <div className="stagger-in flex flex-col gap-4 px-4 py-8">
        <BackLink href="/leaderboard">Zpět na žebříček</BackLink>
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
      .select("id, number, name, status, lock_at, actual_fotn_fight_id")
      .eq("id", eventId)
      .neq("status", "draft")
      .single();

    if (!event) notFound();

    // Same rule as the single-tipper detail: nobody's picks are shown before
    // the deadline, or you could just copy them. RLS already refuses to hand
    // other people's predictions to a normal user, but admins can read them
    // (they need "who hasn't tipped yet"), so without this check the compare
    // view leaked the whole card to an admin - and showed everyone else two
    // suspiciously empty columns.
    const locked =
      event.status === "completed" ||
      (event.lock_at ? new Date(event.lock_at) <= new Date() : false);

    if (!locked) {
      return (
        <div className="stagger-in flex flex-col gap-4 px-4 py-8">
          <BackLink href={`/leaderboard?view=event&eventId=${eventId}`}>Zpět na žebříček</BackLink>
          <h1 className="text-xl font-bold lg:text-3xl">
            {nicknameA} vs {nicknameB}
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {event.number ? `OKTAGON ${event.number}` : event.name}
          </p>
          <p className="text-neutral-600 dark:text-neutral-400">
            Tipy se zobrazí až po uzávěrce galavečera.
          </p>
        </div>
      );
    }

    const { data: fights } = await supabase
      .from("fights")
      .select(
        `id, weight_class, is_title_fight, is_main_event, card_order, rounds, status,
         winner_fighter_id, method, result_round, result_time, odds_fighter_a, odds_fighter_b,
         fighter_a:fighters!fights_fighter_a_id_fkey(id, name, nickname, photo_url, fight_card_photo_url, bio, record, oktagon_rank, oktagon_rank_change, oktagon_slug, weight_kg, height_cm, birth_date, nationality, flag_code, is_tba),
         fighter_b:fighters!fights_fighter_b_id_fkey(id, name, nickname, photo_url, fight_card_photo_url, bio, record, oktagon_rank, oktagon_rank_change, oktagon_slug, weight_kg, height_cm, birth_date, nationality, flag_code, is_tba)`
      )
      .eq("event_id", eventId)
      .order("card_order", { ascending: false });

    const fightIds = (fights ?? []).map((f) => f.id);

    const [
      { data: predictions },
      { data: bonusPredictions },
      { data: leaderboardRows },
      { data: boldPicks },
    ] = await Promise.all([
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
      // jistotka doubles a fight's points on the board - without this the
      // comparison quietly understates whoever staked theirs here
      supabase
        .from("bold_picks")
        .select("user_id, fight_id")
        .eq("event_id", eventId)
        .in("user_id", [a, b]),
    ]);

    const boldByUser = new Map((boldPicks ?? []).map((p) => [p.user_id, p.fight_id]));

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
      <div className="stagger-in flex flex-col gap-4 px-4 py-8">
        <BackLink href={`/leaderboard?view=event&eventId=${eventId}`}>Zpět na žebříček</BackLink>

        <h1 className="text-xl font-bold">
          {nicknameA} vs {nicknameB}
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {event.number ? `OKTAGON ${event.number}` : event.name}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="glass-surface flex flex-col items-center gap-1 rounded-xl border p-4">
            <span className="font-semibold text-yellow-600 dark:text-accent">{nicknameA}</span>
            <span className="text-2xl font-bold">{totalA}</span>
          </div>
          <div className="glass-surface flex flex-col items-center gap-1 rounded-xl border p-4">
            <span className={`font-semibold ${COMPARE_B_TEXT}`}>{nicknameB}</span>
            <span className="text-2xl font-bold">{totalB}</span>
          </div>
        </div>

        {(bonusFightA || bonusFightB || actualFotnFight) && (
          <div className="glass-surface rounded-xl border p-4 text-sm">
            <p className="flex items-center gap-1.5 font-semibold">
              <Swords className="size-4 text-yellow-600 dark:text-accent" />
              Bonus tip: Fight of the Night
            </p>
            <p className="text-yellow-600 dark:text-accent">
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
            <p className={COMPARE_B_TEXT}>
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
                <Trophy className="mr-1 inline size-3.5 text-yellow-600 dark:text-accent" />
                Skutečný Fight of the Night:{" "}
                <span className="text-yellow-600 dark:text-accent">
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
                boldA={boldByUser.get(a) === fight.id}
                boldB={boldByUser.get(b) === fight.id}
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
    <div className="stagger-in flex flex-col gap-4 px-4 py-8">
      <BackLink href={`/leaderboard?view=season`}>Zpět na žebříček</BackLink>

      <h1 className="text-xl font-bold">
        {nicknameA} vs {nicknameB}
      </h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">Sezóna {season}</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass-surface flex flex-col items-center gap-1 rounded-xl border p-4">
          <span className="font-semibold">{nicknameA}</span>
          <span className="text-2xl font-bold">{totalA}</span>
          <span className="text-xs text-neutral-500 dark:text-neutral-300">{winsA}× lepší večer</span>
          {perfectCardsA > 0 && (
            <span className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-300">
              <Trophy className="size-3 text-yellow-600 dark:text-accent" />
              {perfectCardsA}× perfektní karta
            </span>
          )}
        </div>
        <div className="glass-surface flex flex-col items-center gap-1 rounded-xl border p-4">
          <span className="font-semibold">{nicknameB}</span>
          <span className="text-2xl font-bold">{totalB}</span>
          <span className="text-xs text-neutral-500 dark:text-neutral-300">{winsB}× lepší večer</span>
          {perfectCardsB > 0 && (
            <span className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-300">
              <Trophy className="size-3 text-yellow-600 dark:text-accent" />
              {perfectCardsB}× perfektní karta
            </span>
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
              className="glass-surface flex items-center justify-between rounded-xl border p-3 text-sm"
            >
              <span className={cn("w-12 text-right font-bold", pa > pb && "text-yellow-600 dark:text-accent")}>{pa}</span>
              <span className="flex-1 px-3 text-center text-neutral-600 dark:text-neutral-400">
                {event.number ? `OKTAGON ${event.number}` : event.name}
              </span>
              <span className={cn("w-12 font-bold", pb > pa && "text-yellow-600 dark:text-accent")}>{pb}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
