import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const STARTOVNE_CZK = 50;

/** How this user has fared in the startovné pool across every
 * completed, payouts-enabled gala - purely informational, no money
 * moves through the app itself, just a running tally. */
export async function StartovneStats({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id")
    .eq("status", "completed")
    .eq("payouts_enabled", true);

  if (!events || events.length === 0) return null;

  const results = await Promise.all(
    events.map((event) =>
      supabase
        .from("event_leaderboard")
        .select("user_id, points, fights_correct_winner, perfect_card, earliest_prediction_at")
        .eq("event_id", event.id)
        .order("points", { ascending: false })
        .order("fights_correct_winner", { ascending: false })
        .order("perfect_card", { ascending: false })
        .order("earliest_prediction_at", { ascending: true, nullsFirst: false })
    )
  );

  let wins = 0;
  let losses = 0;
  let won = 0;
  let paid = 0;

  for (const { data: rows } of results) {
    if (!rows || rows.length < 2) continue;
    const [winner, ...others] = rows;
    if (winner.user_id === userId) {
      wins += 1;
      won += others.length * STARTOVNE_CZK;
    } else if (others.some((o) => o.user_id === userId)) {
      losses += 1;
      paid += STARTOVNE_CZK;
    }
  }

  if (wins === 0 && losses === 0) return null;

  const net = won - paid;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-4 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Wallet className="size-4 text-yellow-600 dark:text-[#FFD400]" />
        Startovné za celou dobu
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
        <span>
          Vyhráno <strong className="text-black dark:text-white">{wins}×</strong>
        </span>
        <span>
          Prohráno <strong className="text-black dark:text-white">{losses}×</strong>
        </span>
        <span>
          Bilance{" "}
          <strong className={net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
            {net >= 0 ? "+" : ""}
            {net} Kč
          </strong>
        </span>
      </div>
    </div>
  );
}
