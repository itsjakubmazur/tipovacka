import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TipBreakdownCard } from "@/components/predictions/tip-breakdown-card";
import { ShareResultButton } from "@/components/leaderboard/share-result-button";
import { cn } from "@/lib/utils";
import { METHOD_LABELS } from "@/lib/method-labels";
import type { Fight, Method, Prediction } from "@/lib/types";

type EventLeaderboardRow = {
  event_id: string;
  points: number;
  fights_scored: number;
  fights_completed: number;
  perfect_card: boolean;
};

export async function TipperDetail({
  userId,
  eventId,
  season: rawSeason,
}: {
  userId: string;
  eventId?: string;
  season?: string;
}) {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", userId)
    .single();

  if (!profile) {
    notFound();
  }

  if (eventId) {
    const { data: event } = await supabase
      .from("events")
      .select("id, number, name, event_date, status, lock_at, actual_fotn_fight_id, image_url")
      .eq("id", eventId)
      .single();

    if (!event || event.status === "draft") {
      notFound();
    }

    const locked =
      event.status === "completed" ||
      (event.lock_at ? new Date(event.lock_at) <= new Date() : false);

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

    const { data: predictions } = await supabase
      .from("predictions")
      .select("fight_id, predicted_winner_id, predicted_method, predicted_round, points")
      .eq("user_id", userId)
      .in("fight_id", fightIds.length ? fightIds : ["00000000-0000-0000-0000-000000000000"]);

    const predictionByFight = new Map<string, Prediction>(
      (predictions ?? []).map((p) => [p.fight_id, p])
    );

    const { data: bonusPrediction } = await supabase
      .from("bonus_predictions")
      .select("predicted_fotn_fight_id, points")
      .eq("user_id", userId)
      .eq("event_id", eventId)
      .maybeSingle();

    const bonusFight = bonusPrediction
      ? (fights ?? []).find((f) => f.id === bonusPrediction.predicted_fotn_fight_id)
      : null;
    const actualFotnFight = (fights ?? []).find((f) => f.id === event.actual_fotn_fight_id);

    // Rank + share button, only when the viewer is looking at their own
    // finished result.
    const isOwnResult = userData.user.id === userId;
    let shareData: { points: number; rank: number | null; total: number | null } | null = null;
    if (isOwnResult && locked) {
      const { data: leaderboardRows } = await supabase
        .from("event_leaderboard")
        .select("user_id, points")
        .eq("event_id", eventId)
        .order("points", { ascending: false })
        .order("fights_correct_winner", { ascending: false })
        .order("perfect_card", { ascending: false })
        .order("earliest_prediction_at", { ascending: true, nullsFirst: false });
      const index = (leaderboardRows ?? []).findIndex((r) => r.user_id === userId);
      if (index >= 0) {
        shareData = {
          points: leaderboardRows![index].points,
          rank: index + 1,
          total: leaderboardRows!.length,
        };
      }
    }

    return (
      <>
        <div>
          <Link href="/leaderboard" className="text-sm text-neutral-500 dark:text-neutral-300 hover:text-black dark:hover:text-white">
            ← Zpět na žebříček
          </Link>
          <h1 className="mt-1 text-xl font-bold">{profile.nickname ?? "Bez přezdívky"}</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {event.number ? `OKTAGON ${event.number}` : event.name}
          </p>
        </div>

        {!locked ? (
          <p className="text-neutral-600 dark:text-neutral-400">Tipy se zobrazí až po uzávěrce galavečera.</p>
        ) : (
          <>
            {shareData && (
              <ShareResultButton
                eventLabel={event.number ? `OKTAGON ${event.number}` : event.name}
                nickname={profile.nickname ?? "Bez přezdívky"}
                points={shareData.points}
                rank={shareData.rank}
                total={shareData.total}
                imageUrl={event.image_url}
              />
            )}
            {(bonusFight || actualFotnFight) && (
              <div className="rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-4 text-sm shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
                <p className="font-semibold">🥊 Bonus tip: Fight of the Night</p>
                {bonusFight && (
                  <p className="text-neutral-600 dark:text-neutral-400">
                    {(bonusFight as unknown as Fight).fighter_a.name} vs{" "}
                    {(bonusFight as unknown as Fight).fighter_b.name}
                    {bonusPrediction?.points != null && (
                      <span className="ml-2 font-semibold">
                        {bonusPrediction.points > 0
                          ? `Trefeno! +${bonusPrediction.points} b.`
                          : "Netrefeno."}
                      </span>
                    )}
                  </p>
                )}
                {actualFotnFight && (
                  <p className="mt-1 text-xs font-medium">
                    🏆 Skutečný Fight of the Night:{" "}
                    <span className="text-yellow-600 dark:text-[#FFD400]">
                      {(actualFotnFight as unknown as Fight).fighter_a.name} vs{" "}
                      {(actualFotnFight as unknown as Fight).fighter_b.name}
                    </span>
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-col gap-3">
              {(fights ?? []).map((fight) => (
                <TipBreakdownCard
                  key={fight.id}
                  fight={fight as unknown as Fight}
                  prediction={predictionByFight.get(fight.id) ?? null}
                />
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  const season = rawSeason ? Number(rawSeason) : new Date().getFullYear();

  const { data: seasonEvents } = await supabase
    .from("events")
    .select("id, number, name, event_date")
    .neq("status", "draft")
    .order("event_date", { ascending: false });

  const eventsInSeason = (seasonEvents ?? []).filter(
    (e) => new Date(e.event_date).getFullYear() === season
  );
  const eventIds = eventsInSeason.map((e) => e.id);

  const { data: rows } = await supabase
    .from("event_leaderboard")
    .select("event_id, points, fights_scored, fights_completed, perfect_card")
    .eq("user_id", userId)
    .in("event_id", eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"]);

  const rowByEvent = new Map<string, EventLeaderboardRow>(
    (rows ?? []).map((r) => [r.event_id, r])
  );
  const totalPoints = (rows ?? []).reduce((sum, r) => sum + r.points, 0);

  const { data: completedFights } = await supabase
    .from("fights")
    .select("id, event_id, card_order, fighter_a_id, fighter_b_id, odds_fighter_a, odds_fighter_b")
    .in("event_id", eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("status", "completed");

  const eventDateById = new Map(eventsInSeason.map((e) => [e.id, e.event_date]));
  const fightMeta = new Map(
    (completedFights ?? []).map((f) => [
      f.id,
      { eventDate: eventDateById.get(f.event_id) ?? "", cardOrder: f.card_order },
    ])
  );
  const oddsMetaByFight = new Map(
    (completedFights ?? []).map((f) => [
      f.id,
      {
        fighterAId: f.fighter_a_id,
        fighterBId: f.fighter_b_id,
        oddsA: f.odds_fighter_a,
        oddsB: f.odds_fighter_b,
      },
    ])
  );
  const completedFightIds = (completedFights ?? []).map((f) => f.id);

  const { data: gradedPredictions } = await supabase
    .from("predictions")
    .select("fight_id, predicted_winner_id, predicted_method, points")
    .eq("user_id", userId)
    .in("fight_id", completedFightIds.length ? completedFightIds : ["00000000-0000-0000-0000-000000000000"]);

  const ordered = (gradedPredictions ?? [])
    .filter((p) => fightMeta.has(p.fight_id))
    .sort((a, b) => {
      const metaA = fightMeta.get(a.fight_id)!;
      const metaB = fightMeta.get(b.fight_id)!;
      const dateDiff = new Date(metaA.eventDate).getTime() - new Date(metaB.eventDate).getTime();
      return dateDiff !== 0 ? dateDiff : metaA.cardOrder - metaB.cardOrder;
    });

  const totalGraded = ordered.length;
  const hits = ordered.filter((p) => (p.points ?? 0) > 0).length;
  const accuracy = totalGraded > 0 ? Math.round((hits / totalGraded) * 100) : 0;

  let streak = 0;
  for (let i = ordered.length - 1; i >= 0; i--) {
    if ((ordered[i].points ?? 0) > 0) streak++;
    else break;
  }

  const methodStats = new Map<Method, { total: number; hits: number }>();
  for (const p of ordered) {
    const key = p.predicted_method as Method;
    const entry = methodStats.get(key) ?? { total: 0, hits: 0 };
    entry.total += 1;
    if ((p.points ?? 0) > 0) entry.hits += 1;
    methodStats.set(key, entry);
  }

  // Favorite vs. underdog tendency - based on which side had the lower
  // (more likely) decimal odds at the time the fight was graded. Only
  // counts picks where both odds were captured; a tie in odds isn't
  // classified either way.
  const favoriteStats = { total: 0, hits: 0 };
  const underdogStats = { total: 0, hits: 0 };
  for (const p of ordered) {
    const meta = oddsMetaByFight.get(p.fight_id);
    if (!meta || meta.oddsA == null || meta.oddsB == null || meta.oddsA === meta.oddsB) continue;
    const pickedFighterAId = p.predicted_winner_id === meta.fighterAId;
    const pickedOdds = pickedFighterAId ? meta.oddsA : meta.oddsB;
    const otherOdds = pickedFighterAId ? meta.oddsB : meta.oddsA;
    const bucket = pickedOdds < otherOdds ? favoriteStats : underdogStats;
    bucket.total += 1;
    if ((p.points ?? 0) > 0) bucket.hits += 1;
  }
  const oddsClassified = favoriteStats.total + underdogStats.total;
  const underdogShare = oddsClassified > 0 ? underdogStats.total / oddsClassified : 0;

  const perfectCardCount = (rows ?? []).filter((r) => r.perfect_card).length;
  const badges: { icon: string; label: string }[] = [];
  if (perfectCardCount > 0) {
    badges.push({
      icon: "🏆",
      label: perfectCardCount > 1 ? `Perfektní karta ×${perfectCardCount}` : "Perfektní karta",
    });
  }
  if (streak >= 3) badges.push({ icon: "🔥", label: `Na vlně (${streak} v řadě)` });
  if (totalGraded >= 5 && accuracy >= 70) badges.push({ icon: "🎯", label: "Ostrostřelec" });
  if (eventsInSeason.length >= 3 && rows && rows.length === eventsInSeason.length) {
    badges.push({ icon: "📅", label: "Věrný fanda" });
  }
  if (oddsClassified >= 5 && underdogShare >= 0.3) {
    badges.push({ icon: "🎲", label: "Odvážlivec" });
  }

  return (
    <>
      <div>
        <Link href="/leaderboard" className="text-sm text-neutral-500 dark:text-neutral-300 hover:text-black dark:hover:text-white">
          ← Zpět na žebříček
        </Link>
        <h1 className="mt-1 text-xl font-bold">{profile.nickname ?? "Bez přezdívky"}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Sezóna {season} · celkem {totalPoints} b.
        </p>
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              key={badge.label}
              className="flex items-center gap-1.5 rounded-full border border-[#FFD400]/40 bg-[#FFD400]/10 px-3 py-1 text-xs font-medium"
            >
              <span>{badge.icon}</span>
              {badge.label}
            </span>
          ))}
        </div>
      )}

      {totalGraded > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-4 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
          <p className="text-sm font-semibold">Statistiky sezóny</p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-700 dark:text-neutral-300">
            <span>
              Úspěšnost: <strong>{accuracy}%</strong> ({hits}/{totalGraded})
            </span>
            {streak >= 2 && (
              <span>
                🔥 Aktuální série: <strong>{streak}</strong> trefených v řadě
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-neutral-500 dark:text-neutral-300">
            {Array.from(methodStats.entries()).map(([method, s]) => (
              <span key={method}>
                {METHOD_LABELS[method]}: {s.hits}/{s.total}
              </span>
            ))}
          </div>
          {oddsClassified > 0 && (
            <div className="flex flex-wrap gap-3 text-xs text-neutral-500 dark:text-neutral-300">
              <span>
                Favorité: {favoriteStats.hits}/{favoriteStats.total}
                {favoriteStats.total > 0 &&
                  ` (${Math.round((favoriteStats.hits / favoriteStats.total) * 100)}%)`}
              </span>
              <span>
                Outsideři: {underdogStats.hits}/{underdogStats.total}
                {underdogStats.total > 0 &&
                  ` (${Math.round((underdogStats.hits / underdogStats.total) * 100)}%)`}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {eventsInSeason.map((event) => {
          const row = rowByEvent.get(event.id);
          return (
            <Link
              key={event.id}
              href={`/leaderboard/u/${userId}?eventId=${event.id}`}
              className={cn(
                "flex items-center justify-between rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-3 shadow-lg shadow-black/20 transition-shadow hover:shadow-xl hover:border-white/80 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60 dark:hover:border-neutral-500/80"
              )}
            >
              <span className="flex items-center gap-1.5 font-semibold">
                {event.number ? `OKTAGON ${event.number}` : event.name}
                {row?.perfect_card && <Trophy className="size-4 text-yellow-600 dark:text-[#FFD400]" />}
              </span>
              <span className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-300">
                {row ? `po ${row.fights_scored} z ${row.fights_completed} zápasů` : "bez tipů"}
                <span className="text-lg font-bold text-black dark:text-white">{row?.points ?? 0}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
