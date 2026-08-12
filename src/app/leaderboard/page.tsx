import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLeaderboardEvents, getEventLeaderboard, getSeasonLeaderboard } from "@/lib/data/leaderboard";
import { cn } from "@/lib/utils";
import { GLASS_PILL } from "@/lib/pills";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Confetti } from "@/components/confetti";
import { HallOfFame } from "@/components/leaderboard/hall-of-fame";
import { PodiumCard } from "@/components/leaderboard/podium-card";
import { SeasonCompareList } from "@/components/leaderboard/season-compare-list";
import { EventCompareList } from "@/components/leaderboard/event-compare-list";
import { GalaReplay } from "@/components/leaderboard/gala-replay";
import { Disclosure } from "@/components/ui/disclosure";
import { SlideOnChange } from "@/components/ui/slide-on-change";
import { RankJourney } from "@/components/leaderboard/rank-journey";
import { PageHeading } from "@/components/ui/page-heading";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { EventLeaderboardRow, SeasonLeaderboardRow } from "@/lib/data/leaderboard";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; eventId?: string }>;
}) {
  const { view: rawView, eventId: rawEventId } = await searchParams;
  const view = rawView === "season" ? "season" : rawView === "history" ? "history" : "event";

  const supabase = await createClient();

  const [{ data: userData }, events] = await Promise.all([
    supabase.auth.getUser(),
    getLeaderboardEvents(),
  ]);
  if (!userData.user) {
    redirect("/login");
  }
  const currentUserId = userData.user.id;

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
  // 0 = didn't play this gala, so there's no journey to tell
  let myFinalRank = 0;
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

    const board = await getEventLeaderboard(
      selectedEvent.id,
      previousEvent?.id ?? null,
      selectedEvent.status === "completed"
    );
    eventRows = board.eventRows;
    totalFights = board.totalFights;
    replaySteps = board.replaySteps;
    for (const [userId, rank] of Object.entries(board.prevRankByUser)) {
      prevRankByUser.set(userId, rank);
    }
    myFinalRank = eventRows.findIndex((r) => r.user_id === currentUserId) + 1;
  } else {
    seasonRows = await getSeasonLeaderboard(season);
  }

  return (
    <div className="stagger-in flex flex-col gap-4 px-4 py-8">
      <RealtimeRefresh table="predictions" />
      {view === "event" &&
        selectedEvent.status === "completed" &&
        eventRows[0]?.user_id === currentUserId && <Confetti />}
      <PageHeading
        eyebrow={
          view === "history"
            ? "Napříč sezónami"
            : `Sezóna ${season}${
                view === "event" && eventRows.length > 0
                  ? ` · ${eventRows.length} ${
                      eventRows.length === 1
                        ? "tipér"
                        : eventRows.length <= 4
                          ? "tipéři"
                          : "tipérů"
                    }`
                  : ""
              }`
        }
      >
        Žebříček
      </PageHeading>

      {/* One capsule with a piece of glass sliding between the three views,
          the same control the fight card's section jumper uses - rather than
          three loose pills where the active one turns yellow. */}
      <div className="glass-floating inline-flex max-w-full rounded-full p-1">
        <SegmentedControl
          value={view}
          ariaLabel="Zobrazení žebříčku"
          segments={[
            {
              key: "event",
              label: "Galavečer",
              href: `/leaderboard?view=event&eventId=${selectedEvent.id}`,
            },
            {
              key: "season",
              label: `Sezóna ${season}`,
              href: `/leaderboard?view=season&eventId=${selectedEvent.id}`,
            },
            {
              key: "history",
              label: (
                <>
                  <Landmark className="size-4" />
                  Síň slávy
                </>
              ),
              href: "/leaderboard?view=history",
            },
          ]}
        />
      </div>

      {/* the gala switcher belongs right under the Galavečer tab that turns it
          on, not off in the side rail */}
      {view === "event" && (
        <div className="glass-floating inline-flex max-w-full rounded-full p-1">
          <SegmentedControl
            value={selectedEvent.id}
            size="sm"
            ariaLabel="Galavečer"
            segments={events.map((event) => ({
              key: event.id,
              label: event.number ? `OKTAGON ${event.number}` : event.name,
              href: `/leaderboard?view=event&eventId=${event.id}`,
            }))}
          />
        </div>
      )}

      {/* Wrapped belongs to the season you're looking at, not to the hall of
          fame - it recaps one year, and the year is picked right above. */}
      {view === "season" && (
        <Link
          href={`/wrapped?season=${season}`}
          className={cn(
            GLASS_PILL,
            "flex items-center justify-between px-4 py-3 text-sm font-semibold"
          )}
        >
          Tvoje sezóna {season} v číslech (Wrapped)
          <ArrowRight className="size-4 text-neutral-400" />
        </Link>
      )}

      {view === "history" && <HallOfFame />}

      {view !== "history" && (
        // From lg the board gets the wide column and everything around it -
        // the scoring legend, the gala switcher, the podium - moves into a
        // sticky rail beside it. Below lg the rail is display:contents, so the
        // order stays exactly what it always was on a phone.
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] lg:gap-6">
          <aside className="contents lg:col-start-2 lg:row-start-1 lg:block">
            <div className="stagger-in flex flex-col gap-4 lg:sticky lg:top-20">
              <Disclosure
                className="glass-surface rounded-xl border text-xs text-neutral-600 dark:text-neutral-400"
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

              {view === "event" && replaySteps.length > 0 && myFinalRank > 0 && (
                <RankJourney
                  key={`journey-${selectedEvent.id}`}
                  steps={replaySteps}
                  userIds={eventRows.map((r) => r.user_id)}
                  currentUserId={currentUserId}
                  finalRank={myFinalRank}
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
