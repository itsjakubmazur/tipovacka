"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Scale, Check } from "lucide-react";
import { RankMedal } from "@/components/leaderboard/rank-medal";
import { cn } from "@/lib/utils";

type SeasonLeaderboardRow = {
  user_id: string;
  nickname: string | null;
  points: number;
  events_played: number;
};

function galasWord(n: number): string {
  if (n === 1) return "galavečer";
  if (n >= 2 && n <= 4) return "galavečery";
  return "galavečerů";
}

export function SeasonCompareList({
  rows,
  season,
  currentUserId,
}: {
  rows: SeasonLeaderboardRow[];
  season: number;
  currentUserId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(userId: string) {
    setSelected((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
      if (prev.length === 2) return [prev[1], userId];
      return [...prev, userId];
    });
  }

  function compare() {
    if (selected.length !== 2) return;
    router.push(`/leaderboard/compare?a=${selected[0]}&b=${selected[1]}&season=${season}`);
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => {
        const gapToNext = i === 0 ? 0 : rows[i - 1].points - row.points;
        return (
        <div
          key={row.user_id}
          className={cn(
            "flex items-center justify-between rounded-xl border p-3 shadow-lg shadow-black/20 dark:shadow-black/60",
            row.user_id === currentUserId
              ? "border-accent bg-accent/15"
              : "border-white/45 bg-white/35 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35"
          )}
        >
          <div className="flex items-center gap-3">
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
            <RankMedal rank={i + 1} />
            <div className="flex flex-col">
              <Link
                href={`/leaderboard/u/${row.user_id}?season=${season}`}
                // podium + own row only, to spare the free-tier DB a
                // query storm (see EventCompareList)
                prefetch={i < 3 || row.user_id === currentUserId ? true : undefined}
                className="font-semibold hover:underline"
              >
                {row.nickname ?? "Bez přezdívky"}
              </Link>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {row.events_played} {galasWord(row.events_played)}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end leading-tight">
            <span className="text-lg font-bold">{row.points}</span>
            {gapToNext > 0 && (
              <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                −{gapToNext} na {i}. místo
              </span>
            )}
          </div>
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
