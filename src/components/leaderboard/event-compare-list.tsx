"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Scale, TrendingUp, TrendingDown, Minus, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

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
      {rows.map((row, i) => {
        const rank = i + 1;
        const delta = row.delta;
        return (
          <div
            key={row.user_id}
            className={cn(
              "flex items-center justify-between rounded-xl border p-3",
              row.user_id === currentUserId
                ? "border-[#FFD400] bg-[#FFD400]/10"
                : "border-neutral-200 dark:border-neutral-800"
            )}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggle(row.user_id)}
                aria-label="Vybrat k porovnání"
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold transition-colors",
                  selected.includes(row.user_id)
                    ? "border-[#FFD400] bg-[#FFD400] text-black"
                    : "border-neutral-300 dark:border-neutral-700 text-transparent"
                )}
              >
                ✓
              </button>
              <span className="w-6 text-center text-sm font-bold text-neutral-500 dark:text-neutral-300">
                {rank}.
              </span>
              {delta != null && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-xs font-medium",
                    delta > 0
                      ? "text-green-600"
                      : delta < 0
                        ? "text-red-600"
                        : "text-neutral-400"
                  )}
                >
                  {delta > 0 ? (
                    <TrendingUp className="size-3.5" />
                  ) : delta < 0 ? (
                    <TrendingDown className="size-3.5" />
                  ) : (
                    <Minus className="size-3.5" />
                  )}
                  {delta !== 0 && Math.abs(delta)}
                </span>
              )}
              <Link href={`/leaderboard/u/${row.user_id}?eventId=${eventId}`} className="font-semibold hover:underline">
                {row.nickname ?? "Bez přezdívky"}
              </Link>
              {row.perfect_card && <Trophy className="size-4 text-[#FFD400]" />}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-500 dark:text-neutral-300">
                po {row.fights_scored} z {totalFights} zápasů
              </span>
              <span className="text-lg font-bold">{row.points}</span>
            </div>
          </div>
        );
      })}

      {selected.length === 2 && (
        <button
          type="button"
          onClick={compare}
          className="sticky bottom-4 mt-2 flex items-center justify-center gap-2 self-center rounded-full border border-[#FFD400] bg-[#FFD400] px-4 py-2 text-sm font-semibold text-black shadow-lg"
        >
          <Scale className="size-4" />
          Porovnat
        </button>
      )}
    </div>
  );
}
