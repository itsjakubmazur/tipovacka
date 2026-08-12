import { Fragment } from "react";
import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FightTipCard } from "@/components/predictions/fight-tip-card";
import { FotnPicker } from "@/components/predictions/fotn-picker";
import { JumpToUntipped } from "@/components/predictions/jump-to-untipped";
import { EventStatusTimeline } from "@/components/events/event-status-timeline";
import { EventComments } from "@/components/events/event-comments";
import { EventPayoutPool } from "@/components/events/event-payout-pool";
import { FightNightLive } from "@/components/events/fight-night-live";
import { WhoHasntTipped } from "@/components/events/who-hasnt-tipped";
import { BraveryReveal } from "@/components/events/bravery-reveal";
import { FastTipOverlay } from "@/components/predictions/fast-tip-overlay";
import { TipActionBar } from "@/components/predictions/tip-action-bar";
import { BoldPickIntro } from "@/components/predictions/bold-pick-intro";
import { Confetti } from "@/components/confetti";
import type { Fight, Prediction } from "@/lib/types";
import type { EventRow, CommentRow, FinalStandingRow, ConsensusPick } from "@/lib/data/event-detail";

const CARD_SEGMENT_LABELS: Record<NonNullable<Fight["card_segment"]>, string> = {
  main_card: "Hlavní karta",
  prelims: "Prelims",
  free_prelims: "Free Prelims",
};

/** Everything about this gala that's specific to the logged-in viewer: their
 * own predictions, bold pick, FOTN pick, rank, admin flags - fetched fresh on
 * every request (no cache), while the shared shell around it (poster, fight
 * card data, comments) is served from getEventShared()'s cache. Streamed in
 * via Suspense so the shell paints immediately. */
export async function PersonalizedEventData({
  eventId,
  userId,
  event,
  fights,
  comments,
  finalStandings,
  allPredictions,
  locked,
  viewModeCookie,
}: {
  eventId: string;
  userId: string;
  event: EventRow;
  fights: Fight[];
  comments: CommentRow[];
  finalStandings: FinalStandingRow[];
  allPredictions: ConsensusPick[];
  locked: boolean;
  viewModeCookie: string | undefined;
}) {
  const supabase = await createClient();

  const [
    { data: profile },
    { data: bonusPrediction },
    { data: boldPick },
    { data: myLeaderboardRow },
    { data: predictions },
  ] = await Promise.all([
    supabase.from("profiles").select("is_admin, is_superadmin, nickname").eq("id", userId).single(),
    supabase
      .from("bonus_predictions")
      .select("predicted_fotn_fight_id, points")
      .eq("user_id", userId)
      .eq("event_id", eventId)
      .maybeSingle(),
    supabase.from("bold_picks").select("fight_id").eq("user_id", userId).eq("event_id", eventId).maybeSingle(),
    // event_leaderboard already folds in the FOTN and perfect-card bonuses,
    // so "Tvé body" always matches the leaderboard exactly.
    supabase
      .from("event_leaderboard")
      .select("points")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("predictions")
      .select("fight_id, predicted_winner_id, predicted_method, predicted_round, points, updated_at, fights!inner(event_id)")
      .eq("fights.event_id", eventId)
      .eq("user_id", userId),
  ]);

  const isAdmin = profile?.is_admin ?? false;
  // Same "browse as a regular tipper" preference the events listing uses for
  // draft visibility - a superadmin testing what everyone else sees
  // shouldn't still get the payout checklist's admin powers.
  const isSuperadmin = (profile?.is_superadmin ?? false) && viewModeCookie === "admin";

  const boldFightId = boldPick?.fight_id ?? null;
  const scoredSoFar = myLeaderboardRow?.points ?? 0;

  const standings = finalStandings ?? [];
  const myRankIndex = standings.findIndex((r) => r.user_id === userId);
  const finalRank = myRankIndex >= 0 ? myRankIndex + 1 : null;
  const participants = standings.length || null;
  const standingRows = standings.map((r) => ({
    userId: r.user_id,
    nickname: r.nickname ?? "Bez přezdívky",
    points: r.points,
  }));

  const predictionByFight = new Map<string, Prediction>(
    (predictions ?? []).map((p) => [p.fight_id, p as unknown as Prediction])
  );

  const fotnOptions = fights
    .filter((fight) => fight.status !== "cancelled")
    .map((fight) => ({
      id: fight.id,
      fighterAName: fight.fighter_a.name,
      fighterBName: fight.fighter_b.name,
    }));

  const actualFotnFight = fights.find((f) => f.id === event.actual_fotn_fight_id);

  const cancelledFights = fights.filter((f) => f.status === "cancelled");

  const { rows: fightsWithHeaders } = fights
    .filter((f) => f.status !== "cancelled")
    .reduce<{
      rows: { fight: Fight; showSegmentHeader: boolean }[];
      lastSegment: Fight["card_segment"];
    }>(
      (acc, fight) => {
        const showSegmentHeader = Boolean(fight.card_segment && fight.card_segment !== acc.lastSegment);
        return {
          rows: [...acc.rows, { fight, showSegmentHeader }],
          lastSegment: fight.card_segment ?? acc.lastSegment,
        };
      },
      { rows: [], lastSegment: null }
    );

  const picksByFight = new Map<string, Map<string, string[]>>();
  for (const p of allPredictions) {
    const names = picksByFight.get(p.fight_id) ?? new Map<string, string[]>();
    const list = names.get(p.predicted_winner_id) ?? [];
    list.push(p.profiles?.nickname ?? "Bez přezdívky");
    names.set(p.predicted_winner_id, list);
    picksByFight.set(p.fight_id, names);
  }

  // cancelled/no_contest fights don't count toward either side of "X z Y" -
  // matches event_leaderboard's own treatment of them as if they were never
  // on the card at all.
  const countableFights = fights.filter((f) => f.status !== "cancelled" && f.status !== "no_contest");
  const countableFightIds = new Set(countableFights.map((f) => f.id));
  const gradedFights = countableFights.filter((f) => f.status === "completed");
  const countablePredictions = (predictions ?? []).filter((p) => countableFightIds.has(p.fight_id));

  const tippableFightIds = fights
    .filter((fight) => fight.status === "scheduled" && !fight.fighter_a.is_tba && !fight.fighter_b.is_tba)
    .map((f) => f.id);
  const untippedFightIds = tippableFightIds.filter((fid) => !predictionByFight.has(fid));

  // Fast-tip carousel works over the tippable fights in running order (main
  // event as the finale), with the viewer's current picks.
  const tippableFightsAsc = fights
    .filter((f) => f.status === "scheduled" && !f.fighter_a.is_tba && !f.fighter_b.is_tba)
    .sort((a, b) => a.card_order - b.card_order);
  const fastTipPredictions: Record<string, Prediction> = Object.fromEntries(
    tippableFightsAsc.filter((f) => predictionByFight.has(f.id)).map((f) => [f.id, predictionByFight.get(f.id)!])
  );

  return (
    <>
      {/* you won the night - celebrate every time it's opened, it's a few
          seconds and never takes a tap */}
      {event.status === "completed" && finalRank === 1 && <Confetti />}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:gap-6">
        <aside className="contents lg:col-start-2 lg:row-start-1 lg:block">
          <div className="stagger-in flex flex-col gap-4 lg:sticky lg:top-20 lg:-mx-3 lg:h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:overscroll-contain lg:px-3 lg:pb-2">
            <h2 className="hidden text-sm font-bold uppercase tracking-wide text-neutral-500 lg:block dark:text-neutral-400">
              Přehled
            </h2>
            {countableFights.length > 0 && (
              <EventStatusTimeline
                locked={locked}
                completed={event.status === "completed"}
                lockAtIso={event.lock_at}
                eventDateIso={event.event_date}
                tippedCount={countablePredictions.length}
                totalCount={countableFights.length}
                gradedCount={gradedFights.length}
                points={scoredSoFar}
                rank={finalRank}
                participants={participants}
                standings={standingRows}
                currentUserId={userId}
                eventId={eventId}
                actions={
                  !locked && tippableFightsAsc.length > 0 ? (
                    <TipActionBar
                      tippableFightIds={tippableFightIds}
                      initialUntipped={untippedFightIds}
                      fotnAvailable={fotnOptions.length > 0}
                      initialFotnPicked={Boolean(bonusPrediction?.predicted_fotn_fight_id)}
                    >
                      <FastTipOverlay
                        eventId={eventId}
                        userId={userId}
                        fights={tippableFightsAsc}
                        initialPredictions={fastTipPredictions}
                        initialBoldFightId={boldFightId}
                        fotnFights={fotnOptions}
                        initialFotnFightId={bonusPrediction?.predicted_fotn_fight_id ?? null}
                        tippedCountable={countablePredictions.length}
                        totalCountable={countableFights.length}
                      />
                    </TipActionBar>
                  ) : undefined
                }
                footer={
                  <>
                    {event.payouts_enabled && (
                      <span className="flex items-center gap-1.5">
                        <Wallet className="size-3.5 shrink-0" />
                        Startovné 50 Kč · vítěz bere vše · QR po turnaji
                      </span>
                    )}
                    {!locked && <WhoHasntTipped eventId={eventId} />}
                  </>
                }
              />
            )}
            {!locked && countableFights.length > 0 && <BoldPickIntro />}

            {locked && event.status !== "completed" && (
              <FightNightLive
                eventId={eventId}
                fights={fights}
                currentUserId={userId}
                nickname={profile?.nickname ?? "Bez přezdívky"}
                showWatcherNames={isSuperadmin}
                predictionByFight={predictionByFight}
                picksByFight={picksByFight}
              />
            )}

            {/* Only while the gala is running. Who staked their jistotka on
                what is a question you ask before the fights, not after - once
                it's graded the answer is in the points and this is just a
                long list in the way. */}
            {locked && event.status !== "completed" && <BraveryReveal eventId={eventId} fights={fights} />}

            {event.status === "completed" && event.payouts_enabled && (
              <EventPayoutPool
                eventId={eventId}
                eventLabel={event.number ? `OKTAGON ${event.number}` : event.name}
                currentUserId={userId}
                isSuperadmin={isSuperadmin}
              />
            )}

            <EventComments
              eventId={eventId}
              userId={userId}
              isAdmin={isAdmin}
              initialComments={comments}
              livePoll={(() => {
                if (!locked || event.status === "completed") return null;
                const next = fights
                  .filter((f) => f.status === "scheduled" && !f.fighter_a.is_tba && !f.fighter_b.is_tba)
                  .sort((a, b) => a.card_order - b.card_order)[0];
                if (!next) return null;
                return {
                  fightId: next.id,
                  fighterAId: next.fighter_a.id,
                  fighterAName: next.fighter_a.name,
                  fighterBId: next.fighter_b.id,
                  fighterBName: next.fighter_b.name,
                };
              })()}
            />
          </div>
        </aside>

        <div className="stagger-in flex flex-col gap-4 lg:col-start-1 lg:row-start-1 lg:min-w-0">
          {/* From xl the card pairs up - the column is wide enough that a
              single stack of fight cards would just be a lot of empty space
              either side of the fighter names. */}
          <div id="fights" className="flex flex-col gap-5 xl:grid xl:grid-cols-2 xl:items-start">
            {fightsWithHeaders.map(({ fight, showSegmentHeader }, cardIndex) => {
              const names = picksByFight.get(fight.id);
              const fighterANames = names?.get(fight.fighter_a.id) ?? [];
              const fighterBNames = names?.get(fight.fighter_b.id) ?? [];
              const total = fighterANames.length + fighterBNames.length;
              return (
                <Fragment key={fight.id}>
                  {showSegmentHeader && (
                    <h2
                      id={`segment-${fight.card_segment!}`}
                      className="-mb-1 scroll-mt-[calc(env(safe-area-inset-top)+7rem)] text-sm font-bold uppercase tracking-wide text-neutral-500 xl:col-span-2 dark:text-neutral-400"
                    >
                      {CARD_SEGMENT_LABELS[fight.card_segment!]}
                    </h2>
                  )}
                  <div id={`fight-${fight.id}`} className="scroll-mt-16 xl:min-w-0">
                    <FightTipCard
                      fight={fight}
                      userId={userId}
                      eventId={eventId}
                      initialPrediction={predictionByFight.get(fight.id) ?? null}
                      initialIsBold={boldFightId === fight.id}
                      locked={locked}
                      consensus={total > 0 ? { fighterANames, fighterBNames } : undefined}
                      revealIndex={cardIndex}
                    />
                  </div>
                </Fragment>
              );
            })}
          </div>

          {/* FOTN is a bonus meta-pick on top of the fights, so it sits after
              the card - you can't sensibly crown the best fight before you've
              read them. */}
          <h2 className="-mb-1 text-sm font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {locked ? "Bonus" : "Poslední tip"}
          </h2>
          <div id="fotn" className="scroll-mt-16">
            <FotnPicker
              eventId={eventId}
              userId={userId}
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
          </div>

          {cancelledFights.length > 0 && (
            <div className="flex flex-col gap-5 xl:grid xl:grid-cols-2 xl:items-start">
              <h2
                id="segment-cancelled"
                className="-mb-1 scroll-mt-[calc(env(safe-area-inset-top)+7rem)] text-sm font-bold uppercase tracking-wide text-neutral-500 xl:col-span-2 dark:text-neutral-400"
              >
                Zrušené zápasy
              </h2>
              {cancelledFights.map((fight) => (
                <div key={fight.id} className="xl:min-w-0">
                  <FightTipCard
                    fight={fight}
                    userId={userId}
                    initialPrediction={predictionByFight.get(fight.id) ?? null}
                    locked={locked}
                    initialIsBold={boldFightId === fight.id}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!locked && <JumpToUntipped fightIds={tippableFightIds} initialUntipped={untippedFightIds} />}
    </>
  );
}
