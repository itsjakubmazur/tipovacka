import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getEventsListShared } from "@/lib/data/events-list";
import { Badge } from "@/components/ui/badge";
import { TeaserEventCard } from "@/components/events/teaser-event-card";
import { WelcomeCard } from "@/components/events/welcome-card";
import { TippingStatus } from "@/components/events/tipping-status";
import { cn } from "@/lib/utils";
import { cardOpensAtIso } from "@/lib/time";
import { VIEW_MODE_COOKIE } from "@/lib/view-mode";
import { PageHeading } from "@/components/ui/page-heading";

// Deliberately about the *tipping* state, not the gala's - matching the
// status timeline on the event detail ("Tipování otevřené" -> "Tipování
// uzamčeno" -> "Vyhodnoceno"). "Chystá se" used to sit here and contradicted
// it. (The admin list keeps its own labels: admins think in record states.)
const STATUS_LABELS: Record<string, string> = {
  draft: "Návrh",
  upcoming: "Otevřeno",
  locked: "Uzamčeno",
  completed: "Vyhodnoceno",
};

export default async function EventsPage() {
  const supabase = await createClient();

  // Every gala plus its fight count is identical for every viewer - served
  // from the cached shell in parallel with auth, rather than waiting on it.
  // Drafts are included here and filtered per-viewer below (showDrafts).
  const [{ data: userData }, { events, fightCounts }] = await Promise.all([
    supabase.auth.getUser(),
    getEventsListShared(),
  ]);
  const user = userData.user;

  let showDrafts = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .single();
    if (profile?.is_superadmin) {
      const cookieStore = await cookies();
      showDrafts = cookieStore.get(VIEW_MODE_COOKIE)?.value === "admin";
    }
  }

  // Counted in the database, one row per gala. Doing it here in JS meant
  // fetching every fight ever imported plus every prediction the viewer has
  // made, which PostgREST truncates at 1000 rows - around the 90th gala the
  // counters would have started silently under-reporting.
  const { data: tipCounts } = user
    ? await supabase.from("event_user_tip_counts").select("event_id, tipped").eq("user_id", user.id)
    : { data: null as { event_id: string; tipped: number }[] | null };

  const fightCountByEvent = new Map(fightCounts.map((r) => [r.event_id, r.fight_count]));
  const predictionCountByEvent = new Map(
    (tipCounts ?? []).map((r) => [r.event_id as string, r.tipped as number])
  );

  // The two galas a tapper most likely opens - prefetched in full (data
  // and all) so opening them feels instant, while every other card
  // keeps only Next's cheap default prefetch. (1) the current/next one
  // to tip - live gala, else soonest upcoming, else most recent; and
  // (2) the most recently evaluated gala, whose detail is the heaviest
  // (it also renders the startovné pool). At most two, so this stays two
  // extra renders, not one per card.
  const now = new Date();
  // Prefetch targets are only the real, tappable cards - never a draft
  // (its detail 404s for tippers), so compute over the published set.
  const published = (events ?? []).filter((e) => e.status !== "draft");
  const liveEvent = published.find(
    (e) => e.status !== "completed" && e.lock_at && new Date(e.lock_at) <= now
  );
  const upcomingEvent = published
    .filter((e) => new Date(e.event_date) > now)
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())[0];
  const primaryEventId = liveEvent?.id ?? upcomingEvent?.id ?? published[0]?.id ?? null;
  // events are sorted event_date desc, so the first completed is the latest
  const lastCompletedId = published.find((e) => e.status === "completed")?.id ?? null;
  const prefetchIds = new Set([primaryEventId, lastCompletedId].filter(Boolean));

  // The teaser for the next gala appears the moment the previous one is
  // evaluated - i.e. as soon as there's no gala currently being tipped or
  // running (every non-draft event is completed). We tease only the
  // soonest such draft, until its card opens (3 days before, when the
  // scraper flips it to "upcoming" and it becomes a normal card).
  const activeGalaExists = (events ?? []).some(
    (e) => e.status !== "draft" && e.status !== "completed"
  );
  const teaserDraft = activeGalaExists
    ? null
    : (events ?? [])
        .filter(
          (e) =>
            e.status === "draft" &&
            e.event_date &&
            now.getTime() < new Date(cardOpensAtIso(e.event_date)).getTime()
        )
        .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())[0] ?? null;

  return (
    <div className="stagger-in flex flex-col gap-4 px-4 py-8">
      <PageHeading
        eyebrow={`Sezóna ${now.getFullYear()} · ${published.length} ${
          published.length === 1 ? "galavečer" : published.length <= 4 ? "galavečery" : "galavečerů"
        }`}
      >
        Galavečery
      </PageHeading>

      {user && <WelcomeCard />}

      {!events?.length && <p className="text-neutral-600 dark:text-neutral-400">Žádné galavečery zatím nejsou.</p>}

      <div className={cn("flex flex-col gap-3", "lg:grid lg:grid-cols-3 lg:gap-4")}>
        {events?.map((event) => {
          // Drafts always use the teaser card, so an admin previews exactly
          // what everyone else will see. Admins in admin-view get every draft
          // and can still tap through to the detail; other viewers get only
          // the one inside the teaser window, unclickable.
          if (event.status === "draft") {
            if (!showDrafts && event.id !== teaserDraft?.id) return null;
            return (
              <TeaserEventCard
                key={event.id}
                title={event.number ? `OKTAGON ${event.number}` : event.name}
                subtitle={event.subtitle}
                location={event.location}
                eventDateIso={event.event_date}
                openAtIso={cardOpensAtIso(event.event_date)}
                imageUrl={event.image_url}
                href={showDrafts ? `/events/${event.id}` : undefined}
              />
            );
          }

          const locked = event.lock_at ? new Date(event.lock_at) <= new Date() : false;
          const effectiveStatus =
            event.status === "draft"
              ? "draft"
              : event.status === "completed"
                ? "completed"
                : locked
                  ? "locked"
                  : "upcoming";
          const totalFights = fightCountByEvent.get(event.id) ?? 0;
          const tippedCount = predictionCountByEvent.get(event.id) ?? 0;
          return (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              prefetch={prefetchIds.has(event.id) ? true : undefined}
              className={cn(
                // items-end on every card, poster or not: side by side in a
                // grid, a centred card and a bottom-aligned one read as two
                // different components
                "relative flex min-h-[168px] items-end justify-between gap-3 overflow-hidden rounded-xl border p-4 shadow-lg shadow-black/20 transition-shadow hover:shadow-xl dark:shadow-black/60",
                event.image_url
                  ? "border-black/10 hover:border-black/25 dark:border-white/10 dark:hover:border-white/25"
                  : "glass-surface border glass-surface-interactive",
                // the current/next gala leads at full width and gets room for
                // its poster - keyed off primaryEventId rather than DOM
                // position, so a draft teaser that happens to sort first
                // (e.g. a far-future scheduled gala) never inherits the hero
                // slot meant for a real, tappable card
                event.id === primaryEventId && "lg:col-span-3 lg:min-h-[250px]"
              )}
            >
              {event.image_url && (
                <>
                  <Image
                    src={event.image_url}
                    alt=""
                    fill
                    className="object-cover blur-[1px]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/25" />
                </>
              )}
              <div className={cn("relative z-10", event.image_url && "text-white")}>
                <p className="font-semibold">
                  {event.number ? `OKTAGON ${event.number}` : event.name}
                </p>
                {event.subtitle && (
                  <p className={cn("text-sm font-medium", event.image_url ? "text-accent" : "text-yellow-600 dark:text-accent")}>
                    {event.subtitle}
                  </p>
                )}
                <p className={cn("text-sm", event.image_url ? "text-white/80" : "text-neutral-600 dark:text-neutral-400")}>
                  {event.location}
                </p>
                <p className={cn("text-sm", event.image_url ? "text-white/70" : "text-neutral-500 dark:text-neutral-300")}>
                  {new Date(event.event_date).toLocaleString("cs-CZ", {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone: "Europe/Prague",
                  })}
                </p>
                {user && !locked && totalFights > 0 && (
                  <p className={cn("text-sm", event.image_url ? "text-white/70" : "text-neutral-500 dark:text-neutral-300")}>
                    Tipnuto {tippedCount} z {totalFights} zápasů
                  </p>
                )}
              </div>
              {effectiveStatus === "upcoming" && event.lock_at ? (
                <TippingStatus lockAtIso={event.lock_at} onImage={Boolean(event.image_url)} />
              ) : (
                <Badge
                  className="relative z-10"
                  variant={
                    effectiveStatus === "upcoming"
                      ? "accent"
                      : effectiveStatus === "locked"
                        ? "info"
                        : "secondary"
                  }
                >
                  {STATUS_LABELS[effectiveStatus]}
                </Badge>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
