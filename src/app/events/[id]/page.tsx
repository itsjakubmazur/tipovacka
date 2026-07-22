import { Fragment } from "react";
import Image from "next/image";
import { Wallet } from "lucide-react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VIEW_MODE_COOKIE } from "@/lib/view-mode";
import { FightTipCard } from "@/components/predictions/fight-tip-card";
import { FotnPicker } from "@/components/predictions/fotn-picker";
import { JumpToUntipped } from "@/components/predictions/jump-to-untipped";
import { SegmentJump } from "@/components/predictions/segment-jump";
import { DigitalCountdown } from "@/components/digital-countdown";
import { EventComments } from "@/components/events/event-comments";
import { EventPayoutPool } from "@/components/events/event-payout-pool";
import { FightNightLive } from "@/components/events/fight-night-live";
import { FastTipOverlay } from "@/components/predictions/fast-tip-overlay";
import { BoldPickIntro } from "@/components/predictions/bold-pick-intro";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { cn } from "@/lib/utils";
import { GLASS_PILL } from "@/lib/pills";
import { perfStart, perfLog } from "@/lib/perf";
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
  const perf = perfStart();

  // First wave: everything that needs only the event id (or nothing).
  // These used to run one after another - a ~10-query serial waterfall
  // was the biggest chunk of this page's load time.
  const [{ data: event }, { data: userData }, cookieStore] = await Promise.all([
    supabase
      .from("events")
      .select("id, number, name, event_date, location, status, lock_at, image_url, actual_fotn_fight_id, payouts_enabled")
      .eq("id", id)
      .single(),
    supabase.auth.getUser(),
    cookies(),
  ]);

  if (!event) {
    notFound();
  }
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const locked =
    event.status === "completed" ||
    (event.lock_at ? new Date(event.lock_at) <= new Date() : false);

  // Second wave: everything scoped by user and/or event but not by the
  // individual fight ids - all independent, so fetched together.
  const [
    { data: profile },
    { data: fights },
    { data: bonusPrediction },
    { data: boldPick },
    { data: myLeaderboardRow },
    { data: rawComments },
  ] = await Promise.all([
    supabase.from("profiles").select("is_admin, is_superadmin").eq("id", user.id).single(),
    supabase
      .from("fights")
      .select(
        `id, weight_class, is_title_fight, is_main_event, card_order, card_segment, rounds, status,
         winner_fighter_id, method, result_round, result_time, odds_fighter_a, odds_fighter_b,
         fighter_a:fighters!fights_fighter_a_id_fkey(id, name, nickname, photo_url, fight_card_photo_url, bio, record, oktagon_rank, oktagon_rank_change, oktagon_slug, weight_kg, height_cm, birth_date, nationality, flag_code, is_tba),
         fighter_b:fighters!fights_fighter_b_id_fkey(id, name, nickname, photo_url, fight_card_photo_url, bio, record, oktagon_rank, oktagon_rank_change, oktagon_slug, weight_kg, height_cm, birth_date, nationality, flag_code, is_tba)`
      )
      .eq("event_id", id)
      .order("card_order", { ascending: false }),
    supabase
      .from("bonus_predictions")
      .select("predicted_fotn_fight_id, points")
      .eq("user_id", user.id)
      .eq("event_id", id)
      .maybeSingle(),
    supabase
      .from("bold_picks")
      .select("fight_id")
      .eq("user_id", user.id)
      .eq("event_id", id)
      .maybeSingle(),
    // event_leaderboard already folds in the FOTN and perfect-card
    // bonuses, so "Tvé body" always matches the leaderboard exactly.
    supabase
      .from("event_leaderboard")
      .select("points")
      .eq("event_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("event_comments")
      .select(
        "id, user_id, body, created_at, is_system, profiles(nickname), event_comment_reactions(id, user_id, emoji)"
      )
      .eq("event_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const isAdmin = profile?.is_admin ?? false;
  // Same "browse as a regular tipper" preference the events listing
  // uses for draft visibility - a superadmin testing what everyone
  // else sees shouldn't still get the payout checklist's admin powers.
  const isSuperadmin =
    (profile?.is_superadmin ?? false) &&
    cookieStore.get(VIEW_MODE_COOKIE)?.value === "admin";

  if (event.status === "draft" && !isAdmin) {
    notFound();
  }

  const fightIds = (fights ?? []).map((f) => f.id);
  const boldFightId = boldPick?.fight_id ?? null;
  const scoredSoFar = myLeaderboardRow?.points ?? 0;

  // Third wave: the two prediction queries that need the fight ids.
  const [{ data: predictions }, { data: allPredictions }] = await Promise.all([
    supabase
      .from("predictions")
      .select("fight_id, predicted_winner_id, predicted_method, predicted_round, points")
      .eq("user_id", user.id)
      .in("fight_id", fightIds.length ? fightIds : ["00000000-0000-0000-0000-000000000000"]),
    locked && fightIds.length
      ? supabase
          .from("predictions")
          .select("fight_id, predicted_winner_id, profiles(nickname)")
          .in("fight_id", fightIds)
      : Promise.resolve({
          data: null as
            | { fight_id: string; predicted_winner_id: string; profiles: { nickname: string } | null }[]
            | null,
        }),
  ]);

  const predictionByFight = new Map<string, Prediction>(
    (predictions ?? []).map((p) => [p.fight_id, p])
  );

  const fotnOptions = (fights ?? [])
    .map((rawFight) => rawFight as unknown as Fight)
    .filter((fight) => fight.status !== "cancelled")
    .map((fight) => ({
      id: fight.id,
      fighterAName: fight.fighter_a.name,
      fighterBName: fight.fighter_b.name,
    }));

  const actualFotnFight = (fights ?? [])
    .map((f) => f as unknown as Fight)
    .find((f) => f.id === event.actual_fotn_fight_id);

  const cancelledFights = (fights ?? [])
    .map((f) => f as unknown as Fight)
    .filter((f) => f.status === "cancelled");

  const { rows: fightsWithHeaders } = (fights ?? [])
    .filter((f) => (f as unknown as Fight).status !== "cancelled")
    .reduce<{
    rows: { fight: Fight; showSegmentHeader: boolean }[];
    lastSegment: Fight["card_segment"];
  }>(
    (acc, rawFight) => {
      const fight = rawFight as unknown as Fight;
      const showSegmentHeader = Boolean(fight.card_segment && fight.card_segment !== acc.lastSegment);
      return {
        rows: [...acc.rows, { fight, showSegmentHeader }],
        lastSegment: fight.card_segment ?? acc.lastSegment,
      };
    },
    { rows: [], lastSegment: null }
  );

  const picksByFight = new Map<string, Map<string, string[]>>();
  for (const p of (allPredictions ?? []) as unknown as {
    fight_id: string;
    predicted_winner_id: string;
    profiles: { nickname: string } | null;
  }[]) {
    const names = picksByFight.get(p.fight_id) ?? new Map<string, string[]>();
    const list = names.get(p.predicted_winner_id) ?? [];
    list.push(p.profiles?.nickname ?? "Bez přezdívky");
    names.set(p.predicted_winner_id, list);
    picksByFight.set(p.fight_id, names);
  }

  const segmentsOnCard = fightsWithHeaders
    .filter(({ showSegmentHeader }) => showSegmentHeader)
    .map(({ fight }) => ({
      key: fight.card_segment!,
      label: CARD_SEGMENT_LABELS[fight.card_segment!],
    }));

  // cancelled/no_contest fights don't count toward either side of "X z Y"
  // - matches event_leaderboard's own treatment of them as if they were
  // never on the card at all.
  const countableFights = (fights ?? []).filter(
    (f) => f.status !== "cancelled" && f.status !== "no_contest"
  );
  const countableFightIds = new Set(countableFights.map((f) => f.id));
  const gradedFights = countableFights.filter((f) => f.status === "completed");
  const countablePredictions = (predictions ?? []).filter((p) => countableFightIds.has(p.fight_id));

  const tippableFightIds = (fights ?? [])
    .filter((f) => {
      const fight = f as unknown as Fight;
      return (
        fight.status === "scheduled" && !fight.fighter_a.is_tba && !fight.fighter_b.is_tba
      );
    })
    .map((f) => f.id);
  const untippedFightIds = tippableFightIds.filter((fid) => !predictionByFight.has(fid));

  // Fast-tip carousel works over the tippable fights in running order
  // (main event as the finale), with the viewer's current picks.
  const tippableFightsAsc = (fights ?? [])
    .map((f) => f as unknown as Fight)
    .filter((f) => f.status === "scheduled" && !f.fighter_a.is_tba && !f.fighter_b.is_tba)
    .sort((a, b) => a.card_order - b.card_order);
  const fastTipPredictions: Record<string, Prediction> = Object.fromEntries(
    tippableFightsAsc
      .filter((f) => predictionByFight.has(f.id))
      .map((f) => [f.id, predictionByFight.get(f.id)!])
  );

  const comments = ((rawComments ?? []) as unknown as {
    id: string;
    user_id: string | null;
    body: string;
    created_at: string;
    is_system: boolean;
    profiles: { nickname: string } | null;
    event_comment_reactions: { id: string; user_id: string; emoji: string }[];
  }[]).map((c) => ({
    id: c.id,
    user_id: c.user_id,
    body: c.body,
    created_at: c.created_at,
    isSystem: c.is_system,
    nickname: c.profiles?.nickname ?? "Bez přezdívky",
    reactions: c.event_comment_reactions,
  }));

  perfLog(`event/${id}`, perf);

  return (
    <div className="flex flex-col gap-4 px-4 py-8">
      <RealtimeRefresh table="fights" />
      <RealtimeRefresh table="predictions" />
      <RealtimeRefresh table="event_payouts" />
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
        {event.payouts_enabled && (
          <p className={cn(GLASS_PILL, "mt-2 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium")}>
            <Wallet className="size-3.5 text-yellow-600 dark:text-[#FFD400]" />
            Startovné 50 Kč · vítěz bere vše · QR platba po vyhodnocení
          </p>
        )}
        {locked ? (
          <div className="mt-2">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Tipy jsou uzamčené, jen pro čtení.
            </p>
            {event.status !== "completed" && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Galavečer začíná v{" "}
                {new Date(event.event_date).toLocaleTimeString("cs-CZ", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/Prague",
                })}
                , výsledky naskakují průběžně.
              </p>
            )}
          </div>
        ) : (
          event.lock_at && (
            <div className="mt-3">
              <DigitalCountdown lockAt={event.lock_at} />
            </div>
          )
        )}
        {!locked && countableFights.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={cn(GLASS_PILL, "inline-flex items-center px-3 py-1 text-xs font-medium")}>
              Tipnuto {countablePredictions.length} z {countableFights.length} zápasů
            </span>
            {tippableFightsAsc.length > 0 && (
              <FastTipOverlay
                userId={user.id}
                fights={tippableFightsAsc}
                initialPredictions={fastTipPredictions}
                tippedCountable={countablePredictions.length}
                totalCountable={countableFights.length}
              />
            )}
          </div>
        )}
        {!locked && countableFights.length > 0 && <BoldPickIntro />}
        {locked && gradedFights.length > 0 && (
          <span className="mt-2 inline-flex items-baseline gap-2 rounded-full border border-[#FFD400]/60 bg-[#FFD400]/15 backdrop-blur-lg px-4 py-1.5 text-black dark:text-white">
            <span className="text-xs font-medium">
              {event.status === "completed" ? "Tvé body" : "Tvé body zatím"}
            </span>
            <span className="text-xl font-bold tabular-nums">{scoredSoFar}</span>
            <span className="text-xs text-neutral-600 dark:text-neutral-400">
              {gradedFights.length} z {countableFights.length} zápasů odbodováno
            </span>
          </span>
        )}
      </div>

      {locked && event.status !== "completed" && (
        <FightNightLive
          eventId={id}
          fights={(fights ?? []).map((f) => f as unknown as Fight)}
          currentUserId={user.id}
        />
      )}

      {event.status === "completed" && event.payouts_enabled && (
        <EventPayoutPool
          eventId={id}
          eventLabel={event.number ? `OKTAGON ${event.number}` : event.name}
          currentUserId={user.id}
          isSuperadmin={isSuperadmin}
        />
      )}

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

      <SegmentJump segments={segmentsOnCard} />

      <div className="flex flex-col gap-5">
        {fightsWithHeaders.map(({ fight, showSegmentHeader }) => {
          const names = picksByFight.get(fight.id);
          const fighterANames = names?.get(fight.fighter_a.id) ?? [];
          const fighterBNames = names?.get(fight.fighter_b.id) ?? [];
          const total = fighterANames.length + fighterBNames.length;
          return (
            <Fragment key={fight.id}>
              {showSegmentHeader && (
                <h2
                  id={`segment-${fight.card_segment!}`}
                  className="-mb-1 scroll-mt-24 text-sm font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400"
                >
                  {CARD_SEGMENT_LABELS[fight.card_segment!]}
                </h2>
              )}
              <div id={`fight-${fight.id}`} className="scroll-mt-16">
                <FightTipCard
                  fight={fight}
                  userId={user.id}
                  eventId={id}
                  initialPrediction={predictionByFight.get(fight.id) ?? null}
                  initialIsBold={boldFightId === fight.id}
                  locked={locked}
                  consensus={total > 0 ? { fighterANames, fighterBNames } : undefined}
                />
              </div>
            </Fragment>
          );
        })}
      </div>

      {cancelledFights.length > 0 && (
        <div className="flex flex-col gap-5">
          <h2 className="-mb-1 text-sm font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Zrušené zápasy
          </h2>
          {cancelledFights.map((fight) => (
            <FightTipCard
              key={fight.id}
              fight={fight}
              userId={user.id}
              initialPrediction={predictionByFight.get(fight.id) ?? null}
              locked={locked}
            />
          ))}
        </div>
      )}

      <EventComments
        eventId={id}
        userId={user.id}
        isAdmin={isAdmin}
        initialComments={comments}
        livePoll={(() => {
          if (!locked || event.status === "completed") return null;
          const next = (fights ?? [])
            .map((f) => f as unknown as Fight)
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

      {!locked && <JumpToUntipped fightIds={tippableFightIds} initialUntipped={untippedFightIds} />}
    </div>
  );
}
