import { Swords } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Row = {
  event_id: string;
  user_id: string;
  nickname: string | null;
  points: number;
  fights_correct_winner: number;
  perfect_card: boolean;
  earliest_prediction_at: string | null;
};

function rankKey(a: Row, b: Row): number {
  return (
    b.points - a.points ||
    b.fights_correct_winner - a.fights_correct_winner ||
    Number(b.perfect_card) - Number(a.perfect_card) ||
    (a.earliest_prediction_at ?? "").localeCompare(b.earliest_prediction_at ?? "")
  );
}

/** Head-to-head record of the viewer against every other player across the
 * season's completed galas - per gala, whoever placed higher "wins" that
 * night. Friends groups live for the rivalry, and the data's already there. */
export async function NemesisCard({ userId }: { userId: string }) {
  const supabase = await createClient();
  const season = new Date().getFullYear();

  const { data: events } = await supabase
    .from("events")
    .select("id, event_date")
    .eq("status", "completed");

  const seasonEventIds = (events ?? [])
    .filter((e) => e.event_date && new Date(e.event_date).getFullYear() === season)
    .map((e) => e.id);
  if (seasonEventIds.length === 0) return null;

  const { data: rows } = await supabase
    .from("event_leaderboard")
    .select("event_id, user_id, nickname, points, fights_correct_winner, perfect_card, earliest_prediction_at")
    .in("event_id", seasonEventIds);

  const byEvent = new Map<string, Row[]>();
  for (const r of (rows ?? []) as Row[]) {
    const list = byEvent.get(r.event_id) ?? [];
    list.push(r);
    byEvent.set(r.event_id, list);
  }

  type Record = { nickname: string; wins: number; losses: number; draws: number };
  const records = new Map<string, Record>();

  for (const list of byEvent.values()) {
    const me = list.find((r) => r.user_id === userId);
    if (!me) continue; // didn't play this gala
    for (const opp of list) {
      if (opp.user_id === userId) continue;
      const rec = records.get(opp.user_id) ?? {
        nickname: opp.nickname ?? "Bez přezdívky",
        wins: 0,
        losses: 0,
        draws: 0,
      };
      const cmp = rankKey(me, opp);
      if (cmp < 0) rec.wins += 1;
      else if (cmp > 0) rec.losses += 1;
      else rec.draws += 1;
      rec.nickname = opp.nickname ?? rec.nickname;
      records.set(opp.user_id, rec);
    }
  }

  const ranked = [...records.values()]
    .map((r) => ({ ...r, played: r.wins + r.losses + r.draws }))
    .filter((r) => r.played > 0)
    .sort((a, b) => b.played - a.played || b.wins - a.wins);

  if (ranked.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/45 bg-white/35 p-4 shadow-lg shadow-black/20 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Swords className="size-4 text-yellow-600 dark:text-accent" />
        Vzájemné bilance sezóny
      </p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Za každý galavečer bere „výhru“ ten, kdo skončil výš.
      </p>
      <div className="mt-1 flex flex-col gap-1.5">
        {ranked.map((r) => {
          const leading = r.wins > r.losses;
          const trailing = r.losses > r.wins;
          return (
            <div key={r.nickname} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{r.nickname}</span>
              <span className="flex items-center gap-1.5 tabular-nums">
                <span
                  className={
                    leading
                      ? "font-bold text-green-600 dark:text-green-400"
                      : trailing
                        ? "font-bold text-red-600 dark:text-red-400"
                        : "font-semibold text-neutral-500 dark:text-neutral-300"
                  }
                >
                  {r.wins}–{r.losses}
                  {r.draws > 0 ? `–${r.draws}` : ""}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
