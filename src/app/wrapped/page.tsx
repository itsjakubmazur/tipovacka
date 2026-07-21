import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WrappedShareCard } from "@/components/leaderboard/wrapped-share-card";

const STARTOVNE_CZK = 50;

type EventRow = {
  event_id: string;
  user_id: string;
  points: number;
  fights_correct_winner: number;
  perfect_card: boolean;
  earliest_prediction_at: string | null;
};

function rankRows(rows: EventRow[]): EventRow[] {
  return [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.fights_correct_winner - a.fights_correct_winner ||
      Number(b.perfect_card) - Number(a.perfect_card) ||
      (a.earliest_prediction_at ?? "").localeCompare(b.earliest_prediction_at ?? "")
  );
}

/** Personal season recap ("Wrapped") - total points, final rank, event
 * wins, best night and startovné balance, with a shareable PNG card. */
export default async function WrappedPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const { season: rawSeason } = await searchParams;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const season = rawSeason ? Number(rawSeason) : new Date().getFullYear();

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .single();
  const nickname = profile?.nickname ?? "Bez přezdívky";

  const { data: events } = await supabase
    .from("events")
    .select("id, number, name, event_date, status, payouts_enabled")
    .eq("status", "completed")
    .order("event_date", { ascending: true });
  const seasonEvents = (events ?? []).filter(
    (e) => new Date(e.event_date).getFullYear() === season
  );
  const eventIds = seasonEvents.map((e) => e.id);
  const labelByEvent = new Map(
    seasonEvents.map((e) => [e.id, e.number ? `OKTAGON ${e.number}` : e.name])
  );

  const { data: allRows } = await supabase
    .from("event_leaderboard")
    .select("event_id, user_id, points, fights_correct_winner, perfect_card, earliest_prediction_at")
    .in("event_id", eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"]);
  const rows = (allRows ?? []) as EventRow[];

  const myRows = rows.filter((r) => r.user_id === user.id);
  const totalPoints = myRows.reduce((sum, r) => sum + r.points, 0);

  // season rank from season_leaderboard's own tiebreak columns
  const { data: seasonRows } = await supabase
    .from("season_leaderboard")
    .select("user_id, points, fights_correct_winner, perfect_cards, earliest_prediction_at")
    .eq("season", season)
    .order("points", { ascending: false })
    .order("fights_correct_winner", { ascending: false })
    .order("perfect_cards", { ascending: false })
    .order("earliest_prediction_at", { ascending: true, nullsFirst: false });
  const seasonIndex = (seasonRows ?? []).findIndex((r) => r.user_id === user.id);
  const seasonRank = seasonIndex >= 0 ? seasonIndex + 1 : null;
  const seasonTotal = seasonRows?.length ?? null;

  // per-event winner + startovné balance
  const rowsByEvent = new Map<string, EventRow[]>();
  for (const r of rows) {
    const list = rowsByEvent.get(r.event_id) ?? [];
    list.push(r);
    rowsByEvent.set(r.event_id, list);
  }
  let wins = 0;
  let balance = 0;
  let participatedInPayouts = false;
  for (const event of seasonEvents) {
    const list = rowsByEvent.get(event.id);
    if (!list || list.length < 2) continue;
    const ranked = rankRows(list);
    const iWon = ranked[0].user_id === user.id;
    const iPlayed = list.some((r) => r.user_id === user.id);
    if (iWon) wins += 1;
    if (event.payouts_enabled && iPlayed) {
      participatedInPayouts = true;
      balance += iWon ? (list.length - 1) * STARTOVNE_CZK : -STARTOVNE_CZK;
    }
  }

  const bestRow = myRows.length
    ? myRows.reduce((best, r) => (r.points > best.points ? r : best))
    : null;
  const best = bestRow
    ? `${labelByEvent.get(bestRow.event_id) ?? "?"} (${bestRow.points} b.)`
    : null;

  return (
    <div className="flex flex-col gap-4 px-4 py-8">
      <div>
        <Link
          href="/leaderboard"
          className="text-sm text-neutral-500 hover:text-black dark:text-neutral-300 dark:hover:text-white"
        >
          ← Zpět na žebříček
        </Link>
        <h1 className="mt-1 text-xl font-bold">Tvoje sezóna {season}</h1>
      </div>

      {myRows.length === 0 ? (
        <p className="text-neutral-600 dark:text-neutral-400">
          V sezóně {season} zatím nemáš žádný vyhodnocený galavečer.
        </p>
      ) : (
        <WrappedShareCard
          season={season}
          nickname={nickname}
          points={totalPoints}
          rank={seasonRank}
          total={seasonTotal}
          wins={wins}
          best={best}
          balance={participatedInPayouts ? balance : null}
        />
      )}
    </div>
  );
}
