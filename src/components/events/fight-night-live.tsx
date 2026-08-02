import Link from "next/link";
import { Swords, TrendingUp, Target, Flag, Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LiveMiniBoard } from "@/components/events/live-mini-board";
import { WatchingNow } from "@/components/events/watching-now";
import { METHOD_LABELS } from "@/lib/method-labels";
import type { Fight, Method, Prediction } from "@/lib/types";

const MINI_LEADERBOARD_SIZE = 5;
const MAX_POINTS_PER_FIGHT = 3;

/** Live strip for gala night, shown between lock and completion: what's at
 * stake in the next fight, whether the night is still winnable, and a mini
 * leaderboard that reshuffles as results come in (the page already re-renders
 * via RealtimeRefresh on fights/predictions, so this stays current without any
 * polling of its own). */
export async function FightNightLive({
  eventId,
  fights,
  currentUserId,
  nickname,
  showWatcherNames,
  predictionByFight,
  picksByFight,
}: {
  eventId: string;
  fights: Fight[];
  currentUserId: string;
  nickname: string;
  showWatcherNames: boolean;
  /** the viewer's own tips, already loaded by the page */
  predictionByFight: Map<string, Prediction>;
  /** everyone's picks per fight (fighter id -> nicknames), post-lock */
  picksByFight: Map<string, Map<string, string[]>>;
}) {
  const supabase = await createClient();

  // fights run in ascending card_order (prelims first, main event
  // last); the next one up is the lowest-order fight still scheduled
  const remaining = fights
    .filter((f) => f.status === "scheduled" && !f.fighter_a.is_tba && !f.fighter_b.is_tba)
    .sort((a, b) => a.card_order - b.card_order);
  const nextUp = remaining[0] ?? null;

  const [{ data: rows }, { data: myBold }] = await Promise.all([
    supabase
      .from("event_leaderboard")
      .select("user_id, nickname, points, fights_correct_winner, perfect_card, earliest_prediction_at")
      .eq("event_id", eventId)
      .order("points", { ascending: false })
      .order("fights_correct_winner", { ascending: false })
      .order("perfect_card", { ascending: false })
      .order("earliest_prediction_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("bold_picks")
      .select("fight_id")
      .eq("user_id", currentUserId)
      .eq("event_id", eventId)
      .maybeSingle(),
  ]);

  const myPick = nextUp ? predictionByFight.get(nextUp.id) ?? null : null;

  if (!rows || rows.length === 0) return null;

  const myIndex = rows.findIndex((r) => r.user_id === currentUserId);
  const top = rows.slice(0, MINI_LEADERBOARD_SIZE);
  const showMyRowExtra = myIndex >= MINI_LEADERBOARD_SIZE;

  const boardRows = [
    ...top.map((row, i) => ({
      userId: row.user_id,
      rank: i + 1,
      nickname: row.nickname ?? "Bez přezdívky",
      points: row.points,
      gapToNext: i === 0 ? 0 : rows[i - 1].points - row.points,
      isMe: row.user_id === currentUserId,
    })),
    ...(showMyRowExtra
      ? [
          {
            userId: rows[myIndex].user_id,
            rank: myIndex + 1,
            nickname: rows[myIndex].nickname ?? "Bez přezdívky",
            points: rows[myIndex].points,
            gapToNext: rows[myIndex - 1].points - rows[myIndex].points,
            isMe: true,
            separatorBefore: true,
          },
        ]
      : []),
  ];

  // ---- what the next fight is worth to this viewer ----
  const boldOnNext = nextUp != null && myBold?.fight_id === nextUp.id;
  const stakeMax = MAX_POINTS_PER_FIGHT * (boldOnNext ? 2 : 1);
  const myPoints = myIndex >= 0 ? rows[myIndex].points : 0;
  // who is directly ahead, and would a perfect call on this fight clear them?
  const personAhead = myIndex > 0 ? rows[myIndex - 1] : null;
  const overtakes =
    personAhead != null && myPoints + stakeMax > personAhead.points
      ? personAhead.nickname ?? "Bez přezdívky"
      : null;

  const pickedFighter =
    myPick && nextUp
      ? myPick.predicted_winner_id === nextUp.fighter_a.id
        ? nextUp.fighter_a.name
        : nextUp.fighter_b.name
      : null;

  // ---- how the party is split on the fight about to happen ----
  const split = nextUp ? picksByFight.get(nextUp.id) : undefined;
  const forA = split?.get(nextUp?.fighter_a.id ?? "")?.length ?? 0;
  const forB = split?.get(nextUp?.fighter_b.id ?? "")?.length ?? 0;
  const splitTotal = forA + forB;

  // ---- current run of correct calls, in card order ----
  const graded = fights
    .filter((f) => f.status === "completed")
    .sort((a, b) => a.card_order - b.card_order);
  let streak = 0;
  for (let i = graded.length - 1; i >= 0; i--) {
    const points = predictionByFight.get(graded[i].id)?.points ?? 0;
    if (points > 0) streak += 1;
    else break;
  }

  // ---- is the night still winnable? ----
  // Upper bound on what anyone can still collect, so "nobody can catch you"
  // is only ever claimed when it's certainly true.
  const boldStillToCome = myBold != null && remaining.some((f) => f.id === myBold.fight_id);
  const maxStillAvailable =
    remaining.length * MAX_POINTS_PER_FIGHT + (boldStillToCome ? MAX_POINTS_PER_FIGHT : 0);
  const leader = rows[0];
  const iAmLeading = myIndex === 0;
  const leadOverSecond = iAmLeading && rows.length > 1 ? myPoints - rows[1].points : 0;
  const gapToLeader = iAmLeading ? 0 : leader.points - myPoints;

  let endgame: { tone: "good" | "bad"; text: string } | null = null;
  if (remaining.length > 0 && myIndex >= 0 && rows.length > 1) {
    if (iAmLeading && leadOverSecond > maxStillAvailable) {
      endgame = { tone: "good", text: "Vedeš tak, že už tě nikdo nepředběhne." };
    } else if (!iAmLeading && gapToLeader > maxStillAvailable) {
      endgame = {
        tone: "bad",
        text: `Na první místo to už matematicky nevyjde – ztrácíš ${gapToLeader} b. a ve hře jich zbývá ${maxStillAvailable}.`,
      };
    } else if (!iAmLeading) {
      endgame = {
        tone: "good",
        text: `Ztrácíš ${gapToLeader} b. a ve hře jich ještě je ${maxStillAvailable} – pořád to máš ve svých rukou.`,
      };
    }
  }

  return (
    <div className="glass-surface flex flex-col gap-3 rounded-xl border p-4">
      {/* No "Galavečer živě" heading and no graded count here: the status card
          directly above already carries both, and stacked on top of each other
          they read as the page stuttering. This card leads with the thing only
          it knows - which fight is up next. */}
      <div className="flex justify-end">
        <WatchingNow
          eventId={eventId}
          userId={currentUserId}
          nickname={nickname}
          showNames={showWatcherNames}
        />
      </div>

      {nextUp ? (
        <div className="flex flex-col gap-2 rounded-lg border border-yellow-600/40 bg-accent/[0.07] p-3 dark:border-accent/30">
          <a
            href={`#fight-${nextUp.id}`}
            className="flex items-center gap-2 text-sm hover:underline"
          >
            <Swords className="size-4 shrink-0 text-yellow-600 dark:text-accent" />
            <span>
              Na řadě: <strong>{nextUp.fighter_a.name}</strong> vs{" "}
              <strong>{nextUp.fighter_b.name}</strong>
            </span>
          </a>

          <p className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
            <Target className="size-3.5 shrink-0 text-neutral-400" />
            {pickedFighter ? (
              <span>
                Tvůj tip: <strong className="text-black dark:text-white">{pickedFighter}</strong>
                {myPick?.predicted_method &&
                  ` · ${METHOD_LABELS[myPick.predicted_method as Method]}`}
                {myPick?.predicted_round ? ` · ${myPick.predicted_round}. kolo` : ""}
              </span>
            ) : (
              <span>Na tenhle zápas nemáš tip – body z něj ti utečou.</span>
            )}
          </p>

          {splitTotal > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <span
                  className="bg-yellow-600 dark:bg-accent"
                  style={{ width: `${(forA / splitTotal) * 100}%` }}
                />
                <span
                  className="bg-neutral-400 dark:bg-neutral-500"
                  style={{ width: `${(forB / splitTotal) * 100}%` }}
                />
              </div>
              <p className="flex justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                <span className="truncate">
                  {forA}× {nextUp.fighter_a.name}
                </span>
                <span className="truncate">
                  {nextUp.fighter_b.name} ×{forB}
                </span>
              </p>
            </div>
          )}

          {pickedFighter && (
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full border border-yellow-600/50 bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold dark:border-accent/40">
                Ve hře až {stakeMax} b.
                {boldOnNext && " (jistotka ×2)"}
              </span>
              {overtakes && (
                <span className="rounded-full border border-green-600/40 bg-green-600/10 px-2.5 py-0.5 text-[11px] font-semibold text-green-700 dark:text-green-400">
                  Vyjde-li → přeskočíš {overtakes}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Všechny zápasy jsou dobojované, čeká se na vyhodnocení.
        </p>
      )}

      {streak >= 2 && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-yellow-700 dark:text-accent">
          <Flame className="size-3.5 shrink-0" />
          {streak} {streak <= 4 ? "trefy" : "tref"} v řadě – jedeš!
        </p>
      )}

      {endgame && (
        <p
          className={
            endgame.tone === "good"
              ? "flex items-start gap-1.5 text-xs font-medium text-green-700 dark:text-green-400"
              : "flex items-start gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400"
          }
        >
          <Flag className="mt-0.5 size-3.5 shrink-0" />
          {endgame.text}
        </p>
      )}

      <div className="flex flex-col gap-1 border-t border-black/10 pt-3 dark:border-white/10">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
          <TrendingUp className="size-3.5" />
          Průběžné pořadí
        </p>
        <LiveMiniBoard rows={boardRows} />
        <Link
          href={`/leaderboard?eventId=${eventId}`}
          className="mt-1 self-start text-xs text-neutral-500 underline-offset-2 hover:underline dark:text-neutral-400"
        >
          Celý žebříček →
        </Link>
      </div>
    </div>
  );
}
