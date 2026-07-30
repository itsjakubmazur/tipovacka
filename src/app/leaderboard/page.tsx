import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { GLASS_PILL } from "@/lib/pills";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Confetti } from "@/components/confetti";
import { HallOfFame } from "@/components/leaderboard/hall-of-fame";
import { PodiumCard } from "@/components/leaderboard/podium-card";
import { SeasonCompareList } from "@/components/leaderboard/season-compare-list";
import { EventCompareList } from "@/components/leaderboard/event-compare-list";
import { GalaReplay } from "@/components/leaderboard/gala-replay";
import { METHOD_LABELS } from "@/lib/method-labels";
import type { Method } from "@/lib/types";
import { Disclosure } from "@/components/ui/disclosure";
import { SlideOnChange } from "@/components/ui/slide-on-change";

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
    .select("id, number, name, event_date, status, lock_at, image_url")
    .neq("status", "draft")
    .order("event_date", { ascending: false });

  if (!events?.length) {
    return (
      <div className="px-4 py-8">
        <h1 className="text-xl font-bold lg:text-3xl">Žebříček</h1>
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

  // Picks stay secret until the deadline, so the board hides its compare
  // affordance until then (the compare page refuses too, either way).
  const eventLocked =
    selectedEvent.status === "completed" ||
    (selectedEvent.lock_at ? new Date(selectedEvent.lock_at) <= new Date() : false);

  let eventRows: EventLeaderboardRow[] = [];
  let seasonRows: SeasonLeaderboardRow[] = [];
  let totalFights = 0;
  const prevRankByUser = new Map<string, number>();
  // Fight-by-fight replay of a finished gala. Reconstructed from data we
  // already keep - points live on each prediction and fights carry their card
  // order - so there's no stored history to maintain.
  let replaySteps: {
    fightId: string;
    label: string;
    result: string;
    gains: Record<string, number>;
  }[] = [];

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

    if (selectedEvent.status === "completed") {
      const [{ data: replayFights }, { data: replayPicks }, { data: replayBold }] =
        await Promise.all([
          supabase
            .from("fights")
            .select(
              `id, card_order, status, winner_fighter_id, method, result_round,
               fighter_a:fighters!fights_fighter_a_id_fkey(name),
               fighter_b:fighters!fights_fighter_b_id_fkey(name)`
            )
            .eq("event_id", selectedEvent.id)
            .eq("status", "completed")
            .order("card_order", { ascending: true }),
          supabase
            .from("predictions")
            .select("user_id, fight_id, points, fights!inner(event_id)")
            .eq("fights.event_id", selectedEvent.id),
          supabase
            .from("bold_picks")
            .select("user_id, fight_id")
            .eq("event_id", selectedEvent.id),
        ]);

      const boldByUser = new Map(
        (replayBold ?? []).map((b: { user_id: string; fight_id: string }) => [b.user_id, b.fight_id])
      );
      const picks = (replayPicks ?? []) as unknown as {
        user_id: string;
        fight_id: string;
        points: number | null;
      }[];

      replaySteps = ((replayFights ?? []) as unknown as {
        id: string;
        winner_fighter_id: string | null;
        method: string | null;
        result_round: number | null;
        fighter_a: { name: string };
        fighter_b: { name: string };
      }[]).map((fight) => {
        const gains: Record<string, number> = {};
        for (const p of picks) {
          if (p.fight_id !== fight.id || !p.points) continue;
          // the jistotka doubles whatever its fight paid out
          gains[p.user_id] = p.points * (boldByUser.get(p.user_id) === fight.id ? 2 : 1);
        }
        return {
          fightId: fight.id,
          label: `${fight.fighter_a.name} vs ${fight.fighter_b.name}`,
          result: [
            fight.winner_fighter_id ? "" : "bez vítěze",
            fight.method ? METHOD_LABELS[fight.method as Method] : "",
            fight.result_round ? `${fight.result_round}. kolo` : "",
          ]
            .filter(Boolean)
            .join(" · "),
          gains,
        };
      });
    }
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
    <div className="stagger-in flex flex-col gap-4 px-4 py-8">
      <RealtimeRefresh table="predictions" />
      {view === "event" &&
        selectedEvent.status === "completed" &&
        eventRows[0]?.user_id === currentUserId && <Confetti />}
      <h1 className="text-xl font-bold lg:text-3xl">Žebříček</h1>

      <div className="flex gap-2">
        <Link
          href={`/leaderboard?view=event&eventId=${selectedEvent.id}`}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium",
            view === "event" ? "border border-accent bg-accent text-black transition-colors" : GLASS_PILL
          )}
        >
          Galavečer
        </Link>
        <Link
          href={`/leaderboard?view=season&eventId=${selectedEvent.id}`}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium",
            view === "season" ? "border border-accent bg-accent text-black transition-colors" : GLASS_PILL
          )}
        >
          Sezóna {season}
        </Link>
        <Link
          href="/leaderboard?view=history"
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
            view === "history" ? "border border-accent bg-accent text-black transition-colors" : GLASS_PILL
          )}
        >
          <Landmark className="size-4" />
          Síň slávy
        </Link>
      </div>

      {/* the gala switcher belongs right under the Galavečer tab that turns it
          on, not off in the side rail */}
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
            <ArrowRight className="size-4 text-neutral-400" />
          </Link>
          <HallOfFame />
        </>
      )}

      {view !== "history" && (
        // From lg the board gets the wide column and everything around it -
        // the scoring legend, the gala switcher, the podium - moves into a
        // sticky rail beside it. Below lg the rail is display:contents, so the
        // order stays exactly what it always was on a phone.
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] lg:gap-6">
          <aside className="contents lg:col-start-2 lg:row-start-1 lg:block">
            <div className="stagger-in flex flex-col gap-4 lg:sticky lg:top-20">
              <Disclosure
                className="rounded-xl border border-white/45 bg-white/35 text-xs text-neutral-600 shadow-lg shadow-black/20 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:text-neutral-400 dark:shadow-black/60"
                summaryClassName="p-3 font-semibold text-neutral-700 dark:text-neutral-300"
                summary="Za co se dávají body"
              >
                <div className="flex flex-col gap-1 px-3 pb-3">
                  <p>Vítěz zápasu: +1 · způsob ukončení: +1 · kolo (nebo „na body”): +1 — tedy max 3 body za zápas.</p>
                  <p>Jistotka: jeden zápas na galavečer si můžeš označit hvězdičkou — body z něj se ti počítají dvakrát.</p>
                  <p>Bonus tip Fight of the Night: +2, pokud uhodneš zápas večera.</p>
                  <p>Perfektní karta: +5, pokud uhodneš vítěze úplně všech zápasů na kartě.</p>
                  <p>
                    Při shodě bodů rozhoduje: 1) víc uhodnutých vítězů, 2) perfektní karta, 3) kdo odeslal tipy dřív.
                  </p>
                </div>
              </Disclosure>

              {view === "event" && selectedEvent.status === "completed" && eventRows.length >= 3 && (
                <PodiumCard
                  // without a key React keeps the same DOM nodes across galas, and a
                  // CSS animation only runs when its element is created - so the
                  // podium would rise once and never again
                  key={`podium-${selectedEvent.id}`}
                  eventLabel={selectedEvent.number ? `OKTAGON ${selectedEvent.number}` : selectedEvent.name}
                  places={eventRows.slice(0, 3).map((row, i) => ({
                    rank: i + 1,
                    userId: row.user_id,
                    nick: row.nickname ?? "Bez přezdívky",
                    points: row.points,
                  }))}
                  eventId={selectedEvent.id}
                  imageUrl={selectedEvent.image_url}
                />
              )}

              {view === "event" && eventRows.length > 0 && replaySteps.length > 0 && (
                <GalaReplay
                  // distinct from the board's key: two siblings sharing one key
                  // makes React reuse the wrong instance, which carried the
                  // player's open/playing state across galas
                  key={`replay-${selectedEvent.id}`}
                  steps={replaySteps}
                  finalOrder={eventRows.map((r) => ({
                    userId: r.user_id,
                    nickname: r.nickname ?? "Bez přezdívky",
                    points: r.points,
                  }))}
                  currentUserId={currentUserId}
                />
              )}
            </div>
          </aside>

          <div className="stagger-in flex flex-col gap-2 lg:col-start-1 lg:row-start-1 lg:min-w-0">
            {view === "event" && eventRows.length === 0 && (
              <p className="text-neutral-600 dark:text-neutral-400">Zatím nikdo nemá tipy na tento galavečer.</p>
            )}
            {view === "season" && seasonRows.length === 0 && (
              <p className="text-neutral-600 dark:text-neutral-400">Zatím nikdo nemá body v této sezóně.</p>
            )}

            {view === "event" && eventRows.length > 0 && (
              <SlideOnChange index={events.findIndex((e) => e.id === selectedEvent.id)}>
              <EventCompareList
                key={`board-${selectedEvent.id}`}
                rows={eventRows.map((row, i) => {
                  const prevRank = prevRankByUser.get(row.user_id);
                  return { ...row, delta: prevRank != null ? prevRank - (i + 1) : null };
                })}
                eventId={selectedEvent.id}
                totalFights={totalFights}
                currentUserId={currentUserId}
                locked={eventLocked}
              />
              </SlideOnChange>
            )}

            {view === "season" && seasonRows.length > 0 && (
              <SeasonCompareList rows={seasonRows} season={season} currentUserId={currentUserId} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
