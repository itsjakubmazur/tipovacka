import Link from "next/link";
import { BackLink } from "@/components/ui/back-link";
import { notFound, redirect } from "next/navigation";
import {
  CalendarCheck,
  Crosshair,
  Crown,
  Dices,
  Flame,
  Ghost,
  Rocket,
  Swords,
  Target,
  Trophy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TipBreakdownCard } from "@/components/predictions/tip-breakdown-card";
import { ShareResultCard } from "@/components/leaderboard/share-result-button";
import { cn } from "@/lib/utils";
import { METHOD_LABELS } from "@/lib/method-labels";
import { loadSeasonStats, seasonBadges } from "@/lib/season-stats";
import type { Fight, Prediction } from "@/lib/types";

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
    const [{ data: event }, { data: fights }, { data: bonusPrediction }, { data: boldPick }] =
      await Promise.all([
      supabase
        .from("events")
        .select("id, number, name, subtitle, event_date, status, lock_at, actual_fotn_fight_id, image_url")
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
      // which fight carried the jistotka - its points count twice, and the
      // per-fight breakdown has to say the same number as the board
      supabase
        .from("bold_picks")
        .select("fight_id")
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
            .select("user_id, points, perfect_card")
            .eq("event_id", eventId)
            .order("points", { ascending: false })
            .order("fights_correct_winner", { ascending: false })
            .order("perfect_card", { ascending: false })
            .order("earliest_prediction_at", { ascending: true, nullsFirst: false })
        : Promise.resolve({
            data: null as { user_id: string; points: number; perfect_card: boolean }[] | null,
          }),
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
    let shareData:
      | { points: number; rank: number | null; total: number | null; moment: string | null }
      | null = null;
    if (leaderboardRows) {
      const index = leaderboardRows.findIndex((r) => r.user_id === userId);
      if (index >= 0) {
        // Celebrate the standout moments right on the share card.
        const moment =
          leaderboardRows[index].perfect_card
            ? "Perfektní karta"
            : index === 0
              ? "Král večera"
              : null;
        shareData = {
          points: leaderboardRows[index].points,
          rank: index + 1,
          total: leaderboardRows.length,
          moment,
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
            {event.subtitle && <span className="text-yellow-600 dark:text-accent"> · {event.subtitle}</span>}
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
                moment={shareData.moment}
              />
            )}
            {(bonusFight || actualFotnFight) && (
              <div className="glass-surface rounded-xl border p-4 text-sm">
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
                    isBold={boldPick?.fight_id === fight.id}
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
                      isBold={boldPick?.fight_id === fight.id}
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

  // Every number below comes from the shared season engine - Wrapped reads
  // the same one, so the two screens can no longer disagree about the same
  // season.
  const stats = await loadSeasonStats(supabase, userId, season);
  const {
    accuracy,
    favoriteStats,
    hits,
    methodStats,
    oddsClassified,
    segmentStats,
    streak,
    totalGraded,
    totalPoints,
    underdogStats,
  } = stats;
  const nightByEvent = new Map(stats.nights.map((night) => [night.event.id, night]));

  const badgeIconClass = "size-3.5 text-yellow-600 dark:text-accent";
  const BADGE_ICONS: Record<string, React.ReactNode> = {
    king: <Crown className={badgeIconClass} />,
    perfect: <Trophy className={badgeIconClass} />,
    streak: <Flame className={badgeIconClass} />,
    sharp: <Target className={badgeIconClass} />,
    sniper: <Crosshair className={badgeIconClass} />,
    loyal: <CalendarCheck className={badgeIconClass} />,
    brave: <Dices className={badgeIconClass} />,
    "bold-underdog": <Rocket className={badgeIconClass} />,
    "main-event": <Swords className={badgeIconClass} />,
    solo: <Ghost className={badgeIconClass} />,
  };
  const badges = seasonBadges(stats).map((badge) => ({
    label: badge.label,
    icon: BADGE_ICONS[badge.key] ?? null,
  }));


  return (
    <>
      <div>
        <BackLink href="/leaderboard">Zpět na žebříček</BackLink>
        <h1 className="mt-1 text-xl font-bold lg:text-3xl">{profile.nickname ?? "Bez přezdívky"}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Sezóna {season} · celkem {totalPoints} b.
        </p>
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              key={badge.label}
              className="flex items-center gap-1.5 rounded-full glass-accent-soft border px-3 py-1 text-xs font-medium"
            >
              {badge.icon}
              {badge.label}
            </span>
          ))}
        </div>
      )}

      {totalGraded > 0 && (
        <div className="glass-surface flex flex-col gap-2 rounded-xl border p-4">
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
            type Tile = { label: string; value: string; pct?: number };
            const groups: { heading: string; tiles: Tile[] }[] = [
              {
                heading: "Podle způsobu ukončení",
                tiles: Array.from(methodStats.entries()).map(([method, s]) => ({
                  label: METHOD_LABELS[method],
                  value: `${s.hits}/${s.total}`,
                  pct: s.total > 0 ? Math.round((s.hits / s.total) * 100) : undefined,
                })),
              },
              {
                heading: "Podle karty",
                tiles: Array.from(segmentStats.entries()).map(([label, s]) => ({
                  label,
                  value: `${s.hits}/${s.total}`,
                  pct: s.total > 0 ? Math.round((s.hits / s.total) * 100) : undefined,
                })),
              },
              {
                heading: "Podle kurzu",
                tiles:
                  oddsClassified > 0
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
                    : [],
              },
            ].filter((g) => g.tiles.length > 0);
            if (groups.length === 0) return null;
            return (
              <div className="flex flex-col gap-3">
                {groups.map((group) => (
                  <div key={group.heading} className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      {group.heading}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {group.tiles.map((t) => (
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
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {stats.events.map((event) => {
          const night = nightByEvent.get(event.id);
          return (
            <Link
              key={event.id}
              href={`/leaderboard/u/${userId}?eventId=${event.id}`}
              className={cn(
                "glass-surface glass-surface-interactive flex items-center justify-between rounded-xl border p-3"
              )}
            >
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5 font-semibold">
                  {event.label}
                  {night?.perfectCard && (
                    <Trophy className="size-4 shrink-0 text-yellow-600 dark:text-accent" />
                  )}
                </span>
                {event.subtitle && (
                  <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">{event.subtitle}</span>
                )}
              </span>
              <span className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-300">
                {night ? `po ${night.fightsScored} z ${night.fightsCompleted} zápasů` : "bez tipů"}
                <span className="text-lg font-bold text-black dark:text-white">{night?.points ?? 0}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
