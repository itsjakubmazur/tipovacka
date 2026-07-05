import Link from "next/link";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RankMedal } from "@/components/leaderboard/rank-medal";
import { cn } from "@/lib/utils";

type SeasonRow = {
  season: number;
  user_id: string;
  nickname: string | null;
  points: number;
  perfect_cards: number;
};

/** Per-season podium list - rendered as the "Síň slávy" view of the
 * leaderboard page. */
export async function HallOfFame() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("season_leaderboard")
    .select("season, user_id, nickname, points, fights_correct_winner, perfect_cards, earliest_prediction_at")
    .order("season", { ascending: false })
    .order("points", { ascending: false })
    .order("fights_correct_winner", { ascending: false })
    .order("perfect_cards", { ascending: false })
    .order("earliest_prediction_at", { ascending: true, nullsFirst: false });

  const bySeason = new Map<number, SeasonRow[]>();
  for (const row of (rows ?? []) as SeasonRow[]) {
    const list = bySeason.get(row.season) ?? [];
    list.push(row);
    bySeason.set(row.season, list);
  }

  const currentSeason = new Date().getFullYear();
  const seasons = Array.from(bySeason.keys()).sort((a, b) => b - a);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Nejlepší tipéři každé sezóny. Mistr běžící sezóny je zatím jen průběžný.
      </p>

      {seasons.length === 0 && (
        <p className="text-neutral-600 dark:text-neutral-400">Zatím žádná odehraná sezóna.</p>
      )}

      {seasons.map((season) => {
        const podium = bySeason.get(season)!.slice(0, 3);
        const running = season === currentSeason;
        return (
          <div
            key={season}
            className="flex flex-col gap-3 rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-4 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60"
          >
            <div className="flex items-baseline justify-between">
              <p className="font-bold">Sezóna {season}</p>
              {running && (
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">průběžně</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {podium.map((row, i) => (
                <Link
                  key={row.user_id}
                  href={`/leaderboard/u/${row.user_id}?season=${season}`}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5",
                    i === 0 && !running && "bg-[#FFD400]/15"
                  )}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <RankMedal rank={i + 1} />
                    {row.nickname ?? "Bez přezdívky"}
                    {i === 0 && !running && (
                      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        mistr sezóny
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-300">
                    {row.perfect_cards > 0 && (
                      <span className="flex items-center gap-1">
                        <Trophy className="size-4 text-yellow-600 dark:text-[#FFD400]" />×{row.perfect_cards}
                      </span>
                    )}
                    <span className="text-lg font-bold text-black dark:text-white">{row.points}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
