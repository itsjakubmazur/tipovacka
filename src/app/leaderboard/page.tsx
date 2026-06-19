import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type EventLeaderboardRow = {
  user_id: string;
  nickname: string | null;
  points: number;
  fights_scored: number;
  fights_completed: number;
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
    .order("event_date", { ascending: false });

  if (!events?.length) {
    return (
      <div className="px-4 py-8">
        <h1 className="text-xl font-bold">Žebříček</h1>
        <p className="mt-2 text-neutral-600">Žádné galavečery zatím nejsou.</p>
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

  if (view === "event") {
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("event_leaderboard")
        .select("user_id, nickname, points, fights_scored, fights_completed")
        .eq("event_id", selectedEvent.id)
        .order("points", { ascending: false }),
      supabase
        .from("fights")
        .select("id", { count: "exact", head: true })
        .eq("event_id", selectedEvent.id),
    ]);
    eventRows = data ?? [];
    totalFights = count ?? 0;
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
      <h1 className="text-xl font-bold">Žebříček</h1>

      <div className="flex gap-2">
        <Link
          href={`/leaderboard?view=event&eventId=${selectedEvent.id}`}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            view === "event"
              ? "border-[#FFD400] bg-[#FFD400] text-black"
              : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400"
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
              : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400"
          )}
        >
          Sezóna {season}
        </Link>
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
                  : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400"
              )}
            >
              {event.number ? `OKTAGON ${event.number}` : event.name}
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {view === "event" && eventRows.length === 0 && (
          <p className="text-neutral-600">Zatím nikdo nemá tipy na tento galavečer.</p>
        )}
        {view === "season" && seasonRows.length === 0 && (
          <p className="text-neutral-600">Zatím nikdo nemá body v této sezóně.</p>
        )}

        {view === "event" &&
          eventRows.map((row, i) => (
            <div
              key={row.user_id}
              className={cn(
                "flex items-center justify-between rounded-xl border p-3",
                row.user_id === currentUserId
                  ? "border-[#FFD400] bg-[#FFD400]/10"
                  : "border-neutral-200"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-sm font-bold text-neutral-500">
                  {i + 1}.
                </span>
                <span className="font-semibold">{row.nickname ?? "Bez přezdívky"}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-500">
                  po {row.fights_scored} z {totalFights} zápasů
                </span>
                <span className="text-lg font-bold">{row.points}</span>
              </div>
            </div>
          ))}

        {view === "season" &&
          seasonRows.map((row, i) => (
            <div
              key={row.user_id}
              className={cn(
                "flex items-center justify-between rounded-xl border p-3",
                row.user_id === currentUserId
                  ? "border-[#FFD400] bg-[#FFD400]/10"
                  : "border-neutral-200"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-sm font-bold text-neutral-500">
                  {i + 1}.
                </span>
                <span className="font-semibold">{row.nickname ?? "Bez přezdívky"}</span>
              </div>
              <span className="text-lg font-bold">{row.points}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
