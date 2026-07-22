import Link from "next/link";
import { BackLink } from "@/components/ui/back-link";
import { notFound, redirect } from "next/navigation";
import {
  CalendarCheck,
  Crosshair,
  Crown,
  Dices,
  Flame,
  Target,
  Trophy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TipBreakdownCard } from "@/components/predictions/tip-breakdown-card";
import { ShareResultCard } from "@/components/leaderboard/share-result-button";
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

  // auth check and the viewed profile are independent - fetch together
  const [{ data: userData }, { data: profile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("nickname").eq("id", userId).single(),
  ]);
  if (!userData.user) {
    redirect("/login");
  }
  if (!profile) {
    notFound();
  }

  if (eventId) {
    // event, its card, and this user's bonus pick are all independent
    const [{ data: event }, { data: fights }, { data: bonusPrediction }] = await Promise.all([
      supabase
        .from("events")
        .select("id, number, name, event_date, status, lock_at, actual_fotn_fight_id, image_url")
        .eq("id", eventId)
        .single(),
      supabase
        .from("fights")
        .select(
          `id, weight_class, is_title_fight, is_main_event, card_order, rounds, status,
           winner_fighter_id, method, result_round, result_time, odds_fighter_a, odds_fighter_b,
           fighter_a:fighters!fights_fighter_a_id_fkey(id, name, nickname, photo_url, fight_card_photo_url, bio, record, oktagon_rank, oktagon_rank_change, oktagon_slug, weight_kg, height_cm, birth_date, nationality, flag_code, is_tba),
           fighter_b:fighters!fights_fighter_b_id_fkey(id, name, nickname, photo_url, fight_card_photo_url, bio, record, oktagon_rank, oktagon_rank_change, oktagon_slug, weight_kg, height_cm, birth_date, nationality, flag_code, is_tba)`
        )
        .eq("event_id", eventId)
        .order("card_order", { ascending: false }),
      supabase
        .from("bonus_predictions")
        .select("predicted_fotn_fight_id, points")
        .eq("user_id", userId)
        .eq("event_id", eventId)
        .maybeSingle(),
    ]);

    if (!event || event.status === "draft") {
      notFound();
    }

    const locked =
      event.status === "completed" ||
      (event.lock_at ? new Date(event.lock_at) <= new Date() : false);
    const isOwnResult = userData.user.id === userId;

    const fightIds = (fights ?? []).map((f) => f.id);

    // this user's predictions (needs the fight ids) and, only for their
    // own locked result, the full ranked board - fetched together
    const [{ data: predictions }, { data: leaderboardRows }] = await Promise.all([
      supabase
        .from("predictions")
        .select("fight_id, predicted_winner_id, predicted_method, predicted_round, points")
        .eq("user_id", userId)
        .in("fight_id", fightIds.length ? fightIds : ["00000000-0000-0000-0000-000000000000"]),
      isOwnResult && locked
        ? supabase
            .from("event_leaderboard")
            .select("user_id, points")
            .eq("event_id", eventId)
            .order("points", { ascending: false })
            .order("fights_correct_winner", { ascending: false })
            .order("perfect_card", { ascending: false })
            .order("earliest_prediction_at", { ascending: true, nullsFirst: false })
        : Promise.resolve({ data: null as { user_id: string; points: number }[] | null }),
    ]);

    const predictionByFight = new Map<string, Prediction>(
      (predictions ?? []).map((p) => [p.fight_id, p])
    );

    const bonusFight = bonusPrediction
      ? (fights ?? []).find((f) => f.id === bonusPrediction.predicted_fotn_fight_id)
      : null;
    const actualFotnFight = (fights ?? []).find((f) => f.id === event.actual_fotn_fight_id);

    // Rank + share button, only when the viewer is looking at their own
    // finished result (leaderboardRows fetched in the wave above).
    let shareData: { points: number; rank: number | null; total: number | null } | null = null;
    if (leaderboardRows) {
      const index = leaderboardRows.findIndex((r) => r.user_id === userId);
      if (index >= 0) {
        shareData = {
          points: leaderboardRows[index].points,
          rank: index + 1,
          total: leaderboardRows.length,
        };
      }
    }

    return (
      <>
        <div>
          <BackLink href="/leaderboard">Zpět na žebříček</BackLink>
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
              <ShareResultCard
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
                <p className="flex items-center gap-1.5 font-semibold">
                  <Target className="size-4 text-yellow-600 dark:text-accent" />
                  Bonus tip: Fight of the Night
                </p>
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
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-medium">
                    <Trophy className="size-3.5 text-yellow-600 dark:text-accent" />
                    Skutečný Fight of the Night:{" "}
                    <span className="text-yellow-600 dark:text-accent">
                      {(actualFotnFight as unknown as Fight).fighter_a.name} vs{" "}
                      {(actualFotnFight as unknown as Fight).fighter_b.name}
                    </span>
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-col gap-3">
              {(fights ?? [])
                .filter((f) => (f as unknown as Fight).status !== "cancelled")
                .map((fight) => (
                  <TipBreakdownCard
                    key={fight.id}
                    fight={fight as unknown as Fight}
                    prediction={predictionByFight.get(fight.id) ?? null}
                  />
                ))}
            </div>
            {(fights ?? []).some((f) => (f as unknown as Fight).status === "cancelled") && (
              <div className="flex flex-col gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Zrušené zápasy
                </h2>
                {(fights ?? [])
                  .filter((f) => (f as unknown as Fight).status === "cancelled")
                  .map((fight) => (
                    <TipBreakdownCard
                      key={fight.id}
                      fight={fight as unknown as Fight}
                      prediction={predictionByFight.get(fight.id) ?? null}
                    />
                  ))}
              </div>
            )}
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
  const eventIdFilter = eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"];

  // All three only need the season's event ids - fetch together.
  const [{ data: rows }, { data: completedFights }, { data: allEventRows }] = await Promise.all([
    supabase
      .from("event_leaderboard")
      .select("event_id, points, fights_scored, fights_completed, perfect_card")
      .eq("user_id", userId)
      .in("event_id", eventIdFilter),
    supabase
      .from("fights")
      .select(
        "id, event_id, card_order, card_segment, fighter_a_id, fighter_b_id, odds_fighter_a, odds_fighter_b"
      )
      .in("event_id", eventIdFilter)
      .eq("status", "completed"),
    // Who actually won each event - all users' rows, ranked per event
    // client-side with the same tiebreak chain the leaderboard uses.
    supabase
      .from("event_leaderboard")
      .select("event_id, user_id, points, fights_correct_winner, perfect_card, earliest_prediction_at")
      .in("event_id", eventIdFilter),
  ]);

  const rowByEvent = new Map<string, EventLeaderboardRow>(
    (rows ?? []).map((r) => [r.event_id, r])
  );
  const totalPoints = (rows ?? []).reduce((sum, r) => sum + r.points, 0);

  const rowsByEventAll = new Map<string, NonNullable<typeof allEventRows>>();
  for (const r of allEventRows ?? []) {
    const list = rowsByEventAll.get(r.event_id) ?? [];
    list.push(r);
    rowsByEventAll.set(r.event_id, list);
  }
  let eventWins = 0;
  for (const list of rowsByEventAll.values()) {
    if (list.length < 2) continue;
    list.sort(
      (a, b) =>
        b.points - a.points ||
        b.fights_correct_winner - a.fights_correct_winner ||
        Number(b.perfect_card) - Number(a.perfect_card) ||
        (a.earliest_prediction_at ?? "").localeCompare(b.earliest_prediction_at ?? "")
    );
    if (list[0].user_id === userId) eventWins += 1;
  }

  const eventDateById = new Map(eventsInSeason.map((e) => [e.id, e.event_date]));
  const fightMeta = new Map(
    (completedFights ?? []).map((f) => [
      f.id,
      {
        eventDate: eventDateById.get(f.event_id) ?? "",
        cardOrder: f.card_order,
        cardSegment: f.card_segment as string | null,
      },
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

  // Main card vs prelims accuracy - some people nail the headliners
  // and whiff the undercard, worth surfacing.
  const segmentStats = new Map<string, { total: number; hits: number }>();
  for (const p of ordered) {
    const segment = fightMeta.get(p.fight_id)?.cardSegment;
    if (!segment) continue;
    const key = segment === "main_card" ? "Hlavní karta" : "Prelims";
    const entry = segmentStats.get(key) ?? { total: 0, hits: 0 };
    entry.total += 1;
    if ((p.points ?? 0) > 0) entry.hits += 1;
    segmentStats.set(key, entry);
  }

  // Exact hits: winner + method + round/decision all right (3 points).
  const exactHits = ordered.filter((p) => (p.points ?? 0) >= 3).length;

  const perfectCardCount = (rows ?? []).filter((r) => r.perfect_card).length;
  const badgeIconClass = "size-3.5 text-yellow-600 dark:text-accent";
  const badges: { icon: React.ReactNode; label: string }[] = [];
  if (eventWins > 0) {
    badges.push({
      icon: <Crown className={badgeIconClass} />,
      label: eventWins > 1 ? `Král večera ×${eventWins}` : "Král večera",
    });
  }
  if (perfectCardCount > 0) {
    badges.push({
      icon: <Trophy className={badgeIconClass} />,
      label: perfectCardCount > 1 ? `Perfektní karta ×${perfectCardCount}` : "Perfektní karta",
    });
  }
  if (streak >= 3)
    badges.push({ icon: <Flame className={badgeIconClass} />, label: `Na vlně (${streak} v řadě)` });
  if (totalGraded >= 5 && accuracy >= 70)
    badges.push({ icon: <Target className={badgeIconClass} />, label: "Ostrostřelec" });
  if (exactHits >= 3)
    badges.push({
      icon: <Crosshair className={badgeIconClass} />,
      label: `Sniper (přesný tip ×${exactHits})`,
    });
  if (eventsInSeason.length >= 3 && rows && rows.length === eventsInSeason.length) {
    badges.push({ icon: <CalendarCheck className={badgeIconClass} />, label: "Věrný fanda" });
  }
  if (oddsClassified >= 5 && underdogShare >= 0.3) {
    badges.push({ icon: <Dices className={badgeIconClass} />, label: "Odvážlivec" });
  }

  return (
    <>
      <div>
        <BackLink href="/leaderboard">Zpět na žebříček</BackLink>
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
              className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium"
            >
              {badge.icon}
              {badge.label}
            </span>
          ))}
        </div>
      )}

      {totalGraded > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-4 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
          <p className="text-sm font-semibold">Statistiky sezóny</p>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-2xl font-bold tabular-nums text-yellow-600 dark:text-accent">{accuracy}%</p>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                Úspěšnost · {hits}/{totalGraded}
              </p>
            </div>
            <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="flex items-center gap-1.5 text-2xl font-bold tabular-nums">
                {streak >= 2 ? (
                  <>
                    <Flame className="size-5 text-yellow-600 dark:text-accent" />
                    {streak}
                  </>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                {streak >= 2 ? "Trefených v řadě" : "Bez série"}
              </p>
            </div>
          </div>

          {(() => {
            const tiles: { label: string; value: string; pct?: number }[] = [
              ...Array.from(methodStats.entries()).map(([method, s]) => ({
                label: METHOD_LABELS[method],
                value: `${s.hits}/${s.total}`,
              })),
              ...Array.from(segmentStats.entries()).map(([label, s]) => ({
                label,
                value: `${s.hits}/${s.total}`,
                pct: s.total > 0 ? Math.round((s.hits / s.total) * 100) : undefined,
              })),
              ...(oddsClassified > 0
                ? [
                    {
                      label: "Favorité",
                      value: `${favoriteStats.hits}/${favoriteStats.total}`,
                      pct:
                        favoriteStats.total > 0
                          ? Math.round((favoriteStats.hits / favoriteStats.total) * 100)
                          : undefined,
                    },
                    {
                      label: "Outsideři",
                      value: `${underdogStats.hits}/${underdogStats.total}`,
                      pct:
                        underdogStats.total > 0
                          ? Math.round((underdogStats.hits / underdogStats.total) * 100)
                          : undefined,
                    },
                  ]
                : []),
            ];
            if (tiles.length === 0) return null;
            return (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {tiles.map((t) => (
                  <div
                    key={t.label}
                    className="rounded-lg border border-black/5 bg-black/[0.02] p-2.5 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <p className="text-sm font-semibold tabular-nums">
                      {t.value}
                      {t.pct != null && (
                        <span className="ml-1 text-xs font-normal text-neutral-400">{t.pct}%</span>
                      )}
                    </p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{t.label}</p>
                  </div>
                ))}
              </div>
            );
          })()}
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
                {row?.perfect_card && <Trophy className="size-4 text-yellow-600 dark:text-accent" />}
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
