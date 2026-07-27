import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Fight } from "@/lib/types";

/** Post-lock "kdo si věří" reveal: who staked their jistotka (×2) on which
 * fight. Tips are secret until lock, so this only renders once the RLS lets
 * everyone see everyone's bold picks - a little hype moment before results. */
export async function BraveryReveal({
  eventId,
  fights,
}: {
  eventId: string;
  fights: Fight[];
}) {
  const supabase = await createClient();

  const { data: boldPicks } = await supabase
    .from("bold_picks")
    .select("user_id, fight_id, profiles(nickname)")
    .eq("event_id", eventId);

  if (!boldPicks || boldPicks.length === 0) return null;

  const fightById = new Map(fights.map((f) => [f.id, f]));
  const rows = (
    boldPicks as unknown as { user_id: string; fight_id: string; profiles: { nickname: string | null } | null }[]
  )
    .map((b) => {
      const fight = fightById.get(b.fight_id);
      if (!fight) return null;
      return {
        nickname: b.profiles?.nickname ?? "Bez přezdívky",
        matchup: `${fight.fighter_a.name} vs ${fight.fighter_b.name}`,
      };
    })
    .filter((r): r is { nickname: string; matchup: string } => r !== null)
    .sort((a, b) => a.nickname.localeCompare(b.nickname, "cs"));

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/45 bg-white/35 p-4 shadow-lg shadow-black/20 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Star className="size-4 text-yellow-600 dark:text-accent" fill="currentColor" />
        Kdo si věří — jistotky večera
      </p>
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={`${r.nickname}-${i}`} className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
            <span className="font-semibold">{r.nickname}</span>
            <span className="text-neutral-500 dark:text-neutral-400">vsadil jistotku na</span>
            <span className="font-medium text-yellow-700 dark:text-accent">{r.matchup}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
