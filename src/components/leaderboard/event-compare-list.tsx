"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Scale, TrendingUp, TrendingDown, Trophy, Check, RotateCcw } from "lucide-react";
import { RankMedal } from "@/components/leaderboard/rank-medal";
import { CountUp } from "@/components/count-up";
import { useFlipList } from "@/lib/use-flip-list";
import { cn } from "@/lib/utils";

type Snapshot = { order: string[]; points: Record<string, number> };

const REPLAY_HOLD_MS = 900;

type EventCompareRow = {
  user_id: string;
  nickname: string | null;
  points: number;
  fights_scored: number;
  fights_completed: number;
  perfect_card: boolean;
  delta: number | null;
};

export function EventCompareList({
  rows,
  eventId,
  totalFights,
  currentUserId,
}: {
  rows: EventCompareRow[];
  eventId: string;
  totalFights: number;
  currentUserId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  // "What happened while I was away." Animating only live reshuffles would
  // mean almost nobody ever sees it - nobody sits with the board open all
  // evening. So we remember the order and scores from the viewer's last visit
  // and, when they come back to a changed board, paint that old state first
  // and let it play forward into the current one.
  const [replay, setReplay] = useState<Snapshot | null>(null);
  const [since, setSince] = useState<{ gainedPoints: number; movedPlaces: number } | null>(null);
  const lastSeen = useRef<Snapshot | null>(null);
  // which gala `lastSeen` belongs to - switching galas must not compare
  // this board against a different one
  const lastSeenEvent = useRef<string | null>(null);
  // kept apart from `lastSeen` (which advances to the current state) so the
  // replay button still has the old board to play from
  const replayedFrom = useRef<Snapshot | null>(null);
  const signature = rows.map((r) => `${r.user_id}:${r.points}`).join("|");
  const storageKey = `lb-seen-${eventId}`;

  useEffect(() => {
    const current: Snapshot = {
      order: rows.map((r) => r.user_id),
      points: Object.fromEntries(rows.map((r) => [r.user_id, r.points])),
    };

    let previous: Snapshot | null =
      lastSeenEvent.current === eventId ? lastSeen.current : null;
    if (!previous) {
      try {
        previous = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Snapshot | null;
      } catch {
        previous = null;
      }
    }
    lastSeen.current = current;
    lastSeenEvent.current = eventId;
    try {
      localStorage.setItem(storageKey, JSON.stringify(current));
    } catch {
      // private mode - the replay just won't happen next time
    }

    // Nothing to replay on a first-ever visit, or when nothing moved.
    if (!previous?.order?.length) return;
    const sameOrder = previous.order.join("|") === current.order.join("|");
    const samePoints = rows.every((r) => previous.points?.[r.user_id] === r.points);
    if (sameOrder && samePoints) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    replayedFrom.current = previous;

    // summarise the viewer's own move while we still have both states to hand
    const newIndex = rows.findIndex((r) => r.user_id === currentUserId);
    if (newIndex >= 0) {
      const oldIndex = previous.order.indexOf(currentUserId);
      const gainedPoints = rows[newIndex].points - (previous.points?.[currentUserId] ?? 0);
      const movedPlaces = oldIndex < 0 ? 0 : oldIndex - newIndex;
      setSince(gainedPoints === 0 && movedPlaces === 0 ? null : { gainedPoints, movedPlaces });
    }

    setReplay(previous);
    const timer = setTimeout(() => setReplay(null), REPLAY_HOLD_MS);
    return () => clearTimeout(timer);
    // `rows` is covered by `signature`; depending on the array itself would
    // re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, storageKey, currentUserId, eventId]);

  // During the replay the board is drawn as the viewer last left it; dropping
  // `replay` lets it flip and count up into the live state.
  const displayRows = replay
    ? [...rows].sort((a, b) => {
        // anyone absent from the snapshot (joined since) sorts to the bottom
        const ia = replay.order.indexOf(a.user_id);
        const ib = replay.order.indexOf(b.user_id);
        return (ia < 0 ? rows.length : ia) - (ib < 0 ? rows.length : ib);
      })
    : rows;
  const pointsOf = (row: EventCompareRow) =>
    replay ? replay.points[row.user_id] ?? row.points : row.points;

  const rowRef = useFlipList(displayRows.map((r) => r.user_id));

  function replayAgain() {
    const previous = replayedFrom.current;
    if (!previous) return;
    setReplay(previous);
    setTimeout(() => setReplay(null), REPLAY_HOLD_MS);
  }

  function toggle(userId: string) {
    setSelected((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
      if (prev.length === 2) return [prev[1], userId];
      return [...prev, userId];
    });
  }

  function compare() {
    if (selected.length !== 2) return;
    router.push(`/leaderboard/compare?a=${selected[0]}&b=${selected[1]}&eventId=${eventId}`);
  }

  return (
    <div className="flex flex-col gap-2">
      {since && (
        <button
          type="button"
          onClick={replayAgain}
          className="flex items-center gap-2 self-start rounded-full border border-yellow-600/60 bg-accent/10 px-3 py-1 text-xs font-medium dark:border-accent/40"
        >
          <RotateCcw className="size-3.5 text-yellow-700 dark:text-accent" />
          <span>
            Od tvé poslední návštěvy:{" "}
            {since.gainedPoints !== 0 && (
              <strong>
                {since.gainedPoints > 0 ? "+" : ""}
                {since.gainedPoints} b.
              </strong>
            )}
            {since.gainedPoints !== 0 && since.movedPlaces !== 0 && " · "}
            {since.movedPlaces !== 0 && (
              <strong className={since.movedPlaces > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                {since.movedPlaces > 0 ? "↑" : "↓"}
                {Math.abs(since.movedPlaces)} {Math.abs(since.movedPlaces) === 1 ? "místo" : "místa"}
              </strong>
            )}
          </span>
        </button>
      )}
      {displayRows.map((row, i) => {
        const rank = i + 1;
        const delta = row.delta;
        // Gap to the player directly ahead - the number that actually tells
        // you how close the next spot is.
        const gapToNext = i === 0 ? 0 : pointsOf(displayRows[i - 1]) - pointsOf(row);
        return (
          <div
            key={row.user_id}
            ref={rowRef(row.user_id)}
            style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
            className={cn(
              "animate-row-in",
              // fixed columns: pick · rank · name+meta (flexible) · points.
              // Everything variable-width lives in the middle column and
              // truncates, so names never shove the numbers out of line.
              "flex items-center gap-3 rounded-xl border p-3 shadow-lg shadow-black/20 dark:shadow-black/60",
              row.user_id === currentUserId
                ? "border-accent bg-accent/15"
                : "border-white/45 bg-white/35 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35"
            )}
          >
            <button
              type="button"
              onClick={() => toggle(row.user_id)}
              aria-label="Vybrat k porovnání"
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-md border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                selected.includes(row.user_id)
                  ? "border-accent bg-accent text-black"
                  : "border-neutral-300 dark:border-neutral-700"
              )}
            >
              {selected.includes(row.user_id) && <Check className="size-3.5" strokeWidth={3} />}
            </button>

            <span className="flex w-7 shrink-0 justify-center">
              <RankMedal rank={rank} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/leaderboard/u/${row.user_id}?eventId=${eventId}`}
                  // full-prefetch only the podium and the viewer's own row -
                  // prefetching all ~15 would fire a query storm at the
                  // free-tier DB; the rest keep Next's cheap default
                  prefetch={i < 3 || row.user_id === currentUserId ? true : undefined}
                  className="truncate font-semibold hover:underline"
                >
                  {row.nickname ?? "Bez přezdívky"}
                </Link>
                {row.perfect_card && (
                  <Trophy className="size-4 shrink-0 text-yellow-600 dark:text-accent" />
                )}
              </div>
              <div className="flex items-center gap-1.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                {delta != null && delta !== 0 && (
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-0.5 font-medium",
                      delta > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {delta > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    {Math.abs(delta)}
                  </span>
                )}
                <span className="truncate">
                  {row.fights_scored} z {totalFights} zápasů
                  {gapToNext > 0 && ` · −${gapToNext} na ${rank - 1}. místo`}
                </span>
              </div>
            </div>

            <CountUp value={pointsOf(row)} from={pointsOf(row)} className="shrink-0 text-lg font-bold tabular-nums" />
          </div>
        );
      })}

      {selected.length === 2 && (
        <button
          type="button"
          onClick={compare}
          className="sticky bottom-4 mt-2 flex items-center justify-center gap-2 self-center rounded-full border border-accent bg-accent px-4 py-2 text-sm font-semibold text-black shadow-lg"
        >
          <Scale className="size-4" />
          Porovnat
        </button>
      )}
    </div>
  );
}
