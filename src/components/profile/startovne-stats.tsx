import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const STARTOVNE_CZK = 50;

/** How this user has fared in the startovné pool across every completed,
 * payouts-enabled gala. Money moves peer-to-peer outside the app, so the
 * balance reflects what was *actually* settled (event_payouts.paid), not
 * a theoretical pot - and separately flags what's still owed either way,
 * so the number never overstates money that never changed hands. */
export async function StartovneStats({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id")
    .eq("status", "completed")
    .eq("payouts_enabled", true);

  if (!events || events.length === 0) return null;

  const eventIds = events.map((e) => e.id);

  const [boards, { data: payoutRows }] = await Promise.all([
    Promise.all(
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
    ),
    supabase.from("event_payouts").select("event_id, user_id, paid").in("event_id", eventIds),
  ]);

  const paidByEvent = new Map<string, Map<string, boolean>>();
  for (const p of payoutRows ?? []) {
    const m = paidByEvent.get(p.event_id) ?? new Map<string, boolean>();
    m.set(p.user_id, p.paid);
    paidByEvent.set(p.event_id, m);
  }

  let wins = 0;
  let losses = 0;
  let collected = 0; // paid to you (as winner)
  let owedToYou = 0; // others who haven't paid you yet
  let paidOut = 0; // you paid (as loser)
  let youOwe = 0; // you still owe a past winner

  boards.forEach(({ data: rows }, i) => {
    if (!rows || rows.length < 2) return;
    const paidMap = paidByEvent.get(eventIds[i]) ?? new Map<string, boolean>();
    const [winner, ...others] = rows;

    if (winner.user_id === userId) {
      wins += 1;
      for (const o of others) {
        if (paidMap.get(o.user_id)) collected += STARTOVNE_CZK;
        else owedToYou += STARTOVNE_CZK;
      }
    } else if (others.some((o) => o.user_id === userId)) {
      losses += 1;
      if (paidMap.get(userId)) paidOut += STARTOVNE_CZK;
      else youOwe += STARTOVNE_CZK;
    }
  });

  if (wins === 0 && losses === 0) return null;

  const net = collected - paidOut;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-4 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Wallet className="size-4 text-yellow-600 dark:text-accent" />
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
          Vyrovnáno{" "}
          <strong className={net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
            {net >= 0 ? "+" : ""}
            {net} Kč
          </strong>
        </span>
      </div>
      {(owedToYou > 0 || youOwe > 0) && (
        <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          {owedToYou > 0 && (
            <span>
              Ještě ti mají poslat <strong className="text-neutral-700 dark:text-neutral-200">{owedToYou} Kč</strong>
            </span>
          )}
          {youOwe > 0 && (
            <span>
              Ještě dlužíš <strong className="text-neutral-700 dark:text-neutral-200">{youOwe} Kč</strong>
            </span>
          )}
        </p>
      )}
      <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
        Počítá se jen to, co si mezi sebou označíte jako zaplacené.
      </p>
    </div>
  );
}
