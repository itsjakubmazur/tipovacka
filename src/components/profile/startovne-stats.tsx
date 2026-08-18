import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Section } from "@/components/ui/section-heading";
import { STARTOVNE_CZK } from "@/lib/startovne";

type BoardRow = {
  event_id: string;
  user_id: string;
  points: number;
  fights_correct_winner: number;
  perfect_card: boolean;
  earliest_prediction_at: string | null;
};

function rankRows(rows: BoardRow[]): BoardRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.fights_correct_winner !== a.fights_correct_winner) {
      return b.fights_correct_winner - a.fights_correct_winner;
    }
    if (Number(b.perfect_card) !== Number(a.perfect_card)) {
      return Number(b.perfect_card) - Number(a.perfect_card);
    }
    const aT = a.earliest_prediction_at ? Date.parse(a.earliest_prediction_at) : Number.POSITIVE_INFINITY;
    const bT = b.earliest_prediction_at ? Date.parse(b.earliest_prediction_at) : Number.POSITIVE_INFINITY;
    return aT - bT;
  });
}

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

  const [{ data: allRows }, { data: payoutRows }] = await Promise.all([
    supabase
      .from("event_leaderboard")
      .select("event_id, user_id, points, fights_correct_winner, perfect_card, earliest_prediction_at")
      .in("event_id", eventIds),
    supabase.from("event_payouts").select("event_id, user_id, paid").in("event_id", eventIds),
  ]);

  const rowsByEvent = new Map<string, BoardRow[]>();
  for (const row of (allRows ?? []) as BoardRow[]) {
    const list = rowsByEvent.get(row.event_id) ?? [];
    list.push(row);
    rowsByEvent.set(row.event_id, list);
  }

  const paidByEvent = new Map<string, Map<string, boolean>>();
  for (const p of payoutRows ?? []) {
    const m = paidByEvent.get(p.event_id) ?? new Map<string, boolean>();
    m.set(p.user_id, p.paid);
    paidByEvent.set(p.event_id, m);
  }

  let wins = 0;
  let losses = 0;
  let collected = 0;
  let owedToYou = 0;
  let paidOut = 0;
  let youOwe = 0;

  for (const eventId of eventIds) {
    const rows = rankRows(rowsByEvent.get(eventId) ?? []);
    if (rows.length < 2) continue;
    const paidMap = paidByEvent.get(eventId) ?? new Map<string, boolean>();
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
  }

  if (wins === 0 && losses === 0) return null;

  const net = collected - paidOut;

  return (
    <Section title="Startovné za celou dobu" icon={<Wallet className="size-4" />}>
    <div className="glass-surface flex flex-col gap-2 rounded-xl border p-4">
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
    </Section>
  );
}
