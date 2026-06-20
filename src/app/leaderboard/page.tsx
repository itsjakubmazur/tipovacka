import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp, TrendingDown, Minus, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { SeasonCompareList } from "@/components/leaderboard/season-compare-list";

type EventLeaderboardRow = {
  user_id: string;
  nickname: string | null;
  points: number;
  fights_scored: number;
  fights_completed: number;
  perfect_card: boolean;
};

type SeasonLeaderboardRow = {
  user_id: string;
  nickname: string | null;
  points: number;
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; eventId?: string }>;
}) {
  const { view: rawView, eventId: rawEventId } = await searchParams;
  const view = rawView === "season" ? "season" : "event";

  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/login");
  }
  const currentUserId = userData.user.id;

  const { data: events } = await supabase
    .from("events")
    .select("id, number, name, event_date")
    .neq("status", "draft")
    .order("event_date", { ascending: false });

  if (!events?.length) {
    return (
      <div className="px-4 py-8">
        <h1 className="text-xl font-bold">Žebříček</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">Žádné galavečery zatím nejsou.</p>
      </div>
    );
  }

  const now = new Date();
  const defaultEvent =
    events.find((e) => new Date(e.event_date) <= now) ?? events[events.length - 1];
  const selectedEvent =
    events.find((e) => e.id === rawEventId) ?? defaultEvent;

  const season = new Date(selectedEvent.event_date).getFullYear();

  let eventRows: EventLeaderboardRow[] = [];
  let seasonRows: SeasonLeaderboardRow[] = [];
  let totalFights = 0;
  const prevRankByUser = new Map<string, number>();

  if (view === "event") {
    const selectedIndex = events.findIndex((e) => e.id === selectedEvent.id);
    const previousEvent = events[selectedIndex + 1]; // events sorted desc by date

    const [{ data }, { count }, prevResult] = await Promise.all([
      supabase
        .from("event_leaderboard")
        .select("user_id, nickname, points, fights_scored, fights_completed, perfect_card")
        .eq("event_id", selectedEvent.id)
        .order("points", { ascending: false }),
      supabase
        .from("fights")
        .select("id", { count: "exact", head: true })
        .eq("event_id", selectedEvent.id),
      previousEvent
        ? supabase
            .from("event_leaderboard")
            .select("user_id, points")
            .eq("event_id", previousEvent.id)
            .order("points", { ascending: false })
        : Promise.resolve({ data: null }),
    ]);
    eventRows = data ?? [];
    totalFights = count ?? 0;
    (prevResult.data ?? []).forEach((row: { user_id: string }, i: number) => {
      prevRankByUser.set(row.user_id, i + 1);
    });
  } else {
    const { data } = await supabase
      .from("season_leaderboard")
      .select("user_id, nickname, points")
      .eq("season", season)
      .order("points", { ascending: false });
    seasonRows = data ?? [];
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-8">
      <RealtimeRefresh table="predictions" />
      <h1 className="text-xl font-bold">Žebříček</h1>

      <div className="flex gap-2">
        <Link
          href={`/leaderboard?view=event&eventId=${selectedEvent.id}`}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            view === "event"
              ? "border-[#FFD400] bg-[#FFD400] text-black"
              : "border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400"
          )}
        >
          Galavečer
        </Link>
        <Link
          href={`/leaderboard?view=season&eventId=${selectedEvent.id}`}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            view === "season"
              ? "border-[#FFD400] bg-[#FFD400] text-black"
              : "border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400"
          )}
        >
          Sezóna {season}
        </Link>
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 text-xs text-neutral-600 dark:text-neutral-400">
        <p className="font-semibold text-neutral-700 dark:text-neutral-300">Za co se dávají body</p>
        <p>Vítěz zápasu: +1 · způsob ukončení: +1 · kolo (nebo „na body“): +1 — tedy max 3 body za zápas.</p>
        <p>Bonus tip Fight of the Night: +2, pokud uhodneš zápas večera.</p>
        <p>Perfektní karta: +5, pokud uhodneš vítěze úplně všech zápasů na kartě.</p>
      </div>

      {view === "event" && (
        <div className="flex flex-wrap gap-2">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/leaderboard?view=event&eventId=${event.id}`}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                event.id === selectedEvent.id
                  ? "border-neutral-700 bg-neutral-900 text-white"
                  : "border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400"
              )}
            >
              {event.number ? `OKTAGON ${event.number}` : event.name}
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {view === "event" && eventRows.length === 0 && (
          <p className="text-neutral-600 dark:text-neutral-400">Zatím nikdo nemá tipy na tento galavečer.</p>
        )}
        {view === "season" && seasonRows.length === 0 && (
          <p className="text-neutral-600 dark:text-neutral-400">Zatím nikdo nemá body v této sezóně.</p>
        )}

        {view === "event" &&
          eventRows.map((row, i) => {
            const rank = i + 1;
            const prevRank = prevRankByUser.get(row.user_id);
            const delta = prevRank != null ? prevRank - rank : null;
            return (
              <Link
                key={row.user_id}
                href={`/leaderboard/${row.user_id}?eventId=${selectedEvent.id}`}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 transition-colors hover:border-neutral-400",
                  row.user_id === currentUserId
                    ? "border-[#FFD400] bg-[#FFD400]/10"
                    : "border-neutral-200 dark:border-neutral-800"
                )}
              >
                <div className="flex items-center gap-3">
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
                  <span className="font-semibold">{row.nickname ?? "Bez přezdívky"}</span>
                  {row.perfect_card && <Trophy className="size-4 text-[#FFD400]" />}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-500 dark:text-neutral-300">
                    po {row.fights_scored} z {totalFights} zápasů
                  </span>
                  <span className="text-lg font-bold">{row.points}</span>
                </div>
              </Link>
            );
          })}

        {view === "season" && seasonRows.length > 0 && (
          <SeasonCompareList rows={seasonRows} season={season} currentUserId={currentUserId} />
        )}
      </div>
    </div>
  );
}
