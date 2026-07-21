import Link from "next/link";
import { Swords, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Fight } from "@/lib/types";

const MINI_LEADERBOARD_SIZE = 5;

/** Live strip for gala night, shown between lock and completion: which
 * fight is up next and a mini leaderboard that reshuffles as results
 * come in (the page already re-renders via RealtimeRefresh on fights/
 * predictions, so this stays current without any polling of its own). */
export async function FightNightLive({
  eventId,
  fights,
  currentUserId,
}: {
  eventId: string;
  fights: Fight[];
  currentUserId: string;
}) {
  const supabase = await createClient();

  // fights run in ascending card_order (prelims first, main event
  // last); the next one up is the lowest-order fight still scheduled
  const remaining = fights
    .filter((f) => f.status === "scheduled" && !f.fighter_a.is_tba && !f.fighter_b.is_tba)
    .sort((a, b) => a.card_order - b.card_order);
  const nextUp = remaining[0] ?? null;
  const gradedCount = fights.filter((f) => f.status === "completed").length;

  const { data: rows } = await supabase
    .from("event_leaderboard")
    .select("user_id, nickname, points, fights_correct_winner, perfect_card, earliest_prediction_at")
    .eq("event_id", eventId)
    .order("points", { ascending: false })
    .order("fights_correct_winner", { ascending: false })
    .order("perfect_card", { ascending: false })
    .order("earliest_prediction_at", { ascending: true, nullsFirst: false });

  if (!rows || rows.length === 0) return null;

  const myIndex = rows.findIndex((r) => r.user_id === currentUserId);
  const top = rows.slice(0, MINI_LEADERBOARD_SIZE);
  const showMyRowExtra = myIndex >= MINI_LEADERBOARD_SIZE;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/45 bg-white/35 p-4 shadow-lg shadow-black/20 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
        </span>
        Fight Night živě
        {gradedCount > 0 && (
          <span className="font-normal text-neutral-500 dark:text-neutral-400">
            · {gradedCount} {gradedCount === 1 ? "zápas" : gradedCount <= 4 ? "zápasy" : "zápasů"} odbodováno
          </span>
        )}
      </p>

      {nextUp ? (
        <a
          href={`#fight-${nextUp.id}`}
          className="flex items-center gap-2 text-sm text-neutral-700 hover:underline dark:text-neutral-300"
        >
          <Swords className="size-4 shrink-0 text-yellow-600 dark:text-[#FFD400]" />
          <span>
            Další na řadě: <strong>{nextUp.fighter_a.name}</strong> vs{" "}
            <strong>{nextUp.fighter_b.name}</strong>
          </span>
        </a>
      ) : (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Všechny zápasy jsou dobojované, čeká se na vyhodnocení.
        </p>
      )}

      <div className="flex flex-col gap-1 border-t border-black/10 pt-3 dark:border-white/10">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
          <TrendingUp className="size-3.5" />
          Průběžné pořadí
        </p>
        {top.map((row, i) => (
          <MiniRow
            key={row.user_id}
            rank={i + 1}
            nickname={row.nickname ?? "Bez přezdívky"}
            points={row.points}
            isMe={row.user_id === currentUserId}
          />
        ))}
        {showMyRowExtra && (
          <>
            <p className="pl-6 text-xs text-neutral-400 dark:text-neutral-500">…</p>
            <MiniRow
              rank={myIndex + 1}
              nickname={rows[myIndex].nickname ?? "Bez přezdívky"}
              points={rows[myIndex].points}
              isMe
            />
          </>
        )}
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

function MiniRow({
  rank,
  nickname,
  points,
  isMe,
}: {
  rank: number;
  nickname: string;
  points: number;
  isMe: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md px-1.5 py-0.5 text-sm",
        isMe && "bg-[#FFD400]/15 font-semibold"
      )}
    >
      <span className="flex items-center gap-2">
        <span className="w-4 text-right text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
          {rank}.
        </span>
        {nickname}
        {isMe && <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">(ty)</span>}
      </span>
      <span className="font-bold tabular-nums">{points}</span>
    </div>
  );
}
