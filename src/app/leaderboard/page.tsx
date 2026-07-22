import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { GLASS_PILL } from "@/lib/pills";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { HallOfFame } from "@/components/leaderboard/hall-of-fame";
import { PodiumCard } from "@/components/leaderboard/podium-card";
import { SeasonCompareList } from "@/components/leaderboard/season-compare-list";
import { EventCompareList } from "@/components/leaderboard/event-compare-list";

type EventLeaderboardRow = {
  user_id: string;
  nickname: string | null;
  points: number;
  fights_scored: number;
  fights_completed: number;
  perfect_card: boolean;
  fights_correct_winner: number;
  earliest_prediction_at: string | null;
};

type SeasonLeaderboardRow = {
  user_id: string;
  nickname: string | null;
  points: number;
  fights_correct_winner: number;
  perfect_cards: number;
  earliest_prediction_at: string | null;
  events_played: number;
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; eventId?: string }>;
}) {
  const { view: rawView, eventId: rawEventId } = await searchParams;
  const view = rawView === "season" ? "season" : rawView === "history" ? "history" : "event";

  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/login");
  }
  const currentUserId = userData.user.id;

  const { data: events } = await supabase
    .from("events")
    .select("id, number, name, event_date, status, image_url")
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
        .select(
          "user_id, nickname, points, fights_scored, fights_completed, perfect_card, fights_correct_winner, earliest_prediction_at"
        )
        .eq("event_id", selectedEvent.id)
        .order("points", { ascending: false })
        .order("fights_correct_winner", { ascending: false })
        .order("perfect_card", { ascending: false })
        .order("earliest_prediction_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("fights")
        .select("id", { count: "exact", head: true })
        .eq("event_id", selectedEvent.id)
        .not("status", "in", "(cancelled,no_contest)"),
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
      .select(
        "user_id, nickname, points, fights_correct_winner, perfect_cards, earliest_prediction_at, events_played"
      )
      .eq("season", season)
      .order("points", { ascending: false })
      .order("fights_correct_winner", { ascending: false })
      .order("perfect_cards", { ascending: false })
      .order("earliest_prediction_at", { ascending: true, nullsFirst: false });
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
            "rounded-full px-3 py-1.5 text-sm font-medium",
            view === "event" ? "border border-[#FFD400] bg-[#FFD400] text-black transition-colors" : GLASS_PILL
          )}
        >
          Galavečer
        </Link>
        <Link
          href={`/leaderboard?view=season&eventId=${selectedEvent.id}`}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium",
            view === "season" ? "border border-[#FFD400] bg-[#FFD400] text-black transition-colors" : GLASS_PILL
          )}
        >
          Sezóna {season}
        </Link>
        <Link
          href="/leaderboard?view=history"
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
            view === "history" ? "border border-[#FFD400] bg-[#FFD400] text-black transition-colors" : GLASS_PILL
          )}
        >
          <Landmark className="size-4" />
          Síň slávy
        </Link>
      </div>

      {view !== "history" && (
      <details className="group rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg text-xs shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60 text-neutral-600 dark:text-neutral-400">
        <summary className="cursor-pointer select-none p-3 font-semibold text-neutral-700 dark:text-neutral-300 marker:text-neutral-400">
          Za co se dávají body
        </summary>
        <div className="flex flex-col gap-1 px-3 pb-3">
          <p>Vítěz zápasu: +1 · způsob ukončení: +1 · kolo (nebo „na body”): +1 — tedy max 3 body za zápas.</p>
          <p>Jistotka: jeden zápas na galavečer si můžeš označit hvězdičkou — body z něj se ti počítají dvakrát.</p>
          <p>Bonus tip Fight of the Night: +2, pokud uhodneš zápas večera.</p>
          <p>Perfektní karta: +5, pokud uhodneš vítěze úplně všech zápasů na kartě.</p>
          <p>
            Při shodě bodů rozhoduje: 1) víc uhodnutých vítězů, 2) perfektní karta, 3) kdo odeslal tipy dřív.
          </p>
        </div>
      </details>
      )}

      {view === "event" && (
        <div className="flex flex-wrap gap-2">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/leaderboard?view=event&eventId=${event.id}`}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                event.id === selectedEvent.id
                  ? "border border-neutral-700 bg-neutral-900 text-white transition-colors"
                  : GLASS_PILL
              )}
            >
              {event.number ? `OKTAGON ${event.number}` : event.name}
            </Link>
          ))}
        </div>
      )}

      {view === "history" && (
        <>
          <Link
            href="/wrapped"
            className={cn(
              GLASS_PILL,
              "flex items-center justify-between px-4 py-3 text-sm font-semibold"
            )}
          >
            Tvoje sezóna v číslech (Wrapped)
            <span className="text-neutral-400">→</span>
          </Link>
          <HallOfFame />
        </>
      )}

      {view === "event" && selectedEvent.status === "completed" && eventRows.length >= 3 && (
        <PodiumCard
          eventLabel={selectedEvent.number ? `OKTAGON ${selectedEvent.number}` : selectedEvent.name}
          places={eventRows.slice(0, 3).map((row, i) => ({
            rank: i + 1,
            nick: row.nickname ?? "Bez přezdívky",
            points: row.points,
          }))}
          imageUrl={selectedEvent.image_url}
        />
      )}

      <div className="flex flex-col gap-2">
        {view === "event" && eventRows.length === 0 && (
          <p className="text-neutral-600 dark:text-neutral-400">Zatím nikdo nemá tipy na tento galavečer.</p>
        )}
        {view === "season" && seasonRows.length === 0 && (
          <p className="text-neutral-600 dark:text-neutral-400">Zatím nikdo nemá body v této sezóně.</p>
        )}

        {view === "event" && eventRows.length > 0 && (
          <EventCompareList
            rows={eventRows.map((row, i) => {
              const prevRank = prevRankByUser.get(row.user_id);
              return { ...row, delta: prevRank != null ? prevRank - (i + 1) : null };
            })}
            eventId={selectedEvent.id}
            totalFights={totalFights}
            currentUserId={currentUserId}
          />
        )}

        {view === "season" && seasonRows.length > 0 && (
          <SeasonCompareList rows={seasonRows} season={season} currentUserId={currentUserId} />
        )}
      </div>
    </div>
  );
}
