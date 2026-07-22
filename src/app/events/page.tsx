import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { TeaserEventCard } from "@/components/events/teaser-event-card";
import { cn } from "@/lib/utils";
import { cardOpensAtIso, pragueDaysBeforeIso } from "@/lib/time";
import { VIEW_MODE_COOKIE } from "@/lib/view-mode";

// How long before a gala starts its dimmed "coming soon" teaser card
// appears to tippers - a few days ahead of the card actually opening
// (3 days before, 9:00 Prague), to build anticipation.
const TEASER_WINDOW_DAYS = 10;

const STATUS_LABELS: Record<string, string> = {
  draft: "Návrh",
  upcoming: "Chystá se",
  locked: "Uzamčeno",
  completed: "Vyhodnoceno",
};

export default async function EventsPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
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

  // Fetch everything (drafts included): admins in admin-view see drafts
  // as normal cards, and regular tippers see a draft as a dimmed teaser
  // card once it's inside the teaser window. Anything else draft is
  // filtered out per-row below.
  const { data: events } = await supabase
    .from("events")
    .select("id, number, name, event_date, location, status, lock_at, image_url")
    .order("event_date", { ascending: false });

  const { data: fights } = await supabase.from("fights").select("id, event_id");

  const fightCountByEvent = new Map<string, number>();
  (fights ?? []).forEach((f) =>
    fightCountByEvent.set(f.event_id, (fightCountByEvent.get(f.event_id) ?? 0) + 1)
  );

  const predictionCountByEvent = new Map<string, number>();
  if (user) {
    const fightToEvent = new Map((fights ?? []).map((f) => [f.id, f.event_id]));
    const { data: predictions } = await supabase
      .from("predictions")
      .select("fight_id")
      .eq("user_id", user.id);
    (predictions ?? []).forEach((p) => {
      const eventId = fightToEvent.get(p.fight_id);
      if (eventId) {
        predictionCountByEvent.set(eventId, (predictionCountByEvent.get(eventId) ?? 0) + 1);
      }
    });
  }

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

  // Whether a draft should show to a regular tipper as a dimmed teaser:
  // inside the [start - TEASER_WINDOW_DAYS, card-opens) window. At/after
  // card-open the scraper flips it to "upcoming" (a normal card).
  function teaserOpenAt(eventDate: string | null): string | null {
    if (!eventDate) return null;
    const openAt = cardOpensAtIso(eventDate);
    // window opens at 00:00 Prague on the day TEASER_WINDOW_DAYS before,
    // so the teaser is visible for that whole calendar day (not gated to
    // the exact event time of day)
    const windowStart = new Date(pragueDaysBeforeIso(eventDate, TEASER_WINDOW_DAYS, 0)).getTime();
    const t = now.getTime();
    return t >= windowStart && t < new Date(openAt).getTime() ? openAt : null;
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-8">
      <h1 className="text-xl font-bold">Galavečery</h1>

      {!events?.length && <p className="text-neutral-600 dark:text-neutral-400">Žádné galavečery zatím nejsou.</p>}

      <div className="flex flex-col gap-3">
        {events?.map((event) => {
          // Drafts: admins in admin-view see them as normal cards; every
          // other viewer sees a teaser card inside the window, nothing
          // otherwise.
          if (event.status === "draft" && !showDrafts) {
            const openAt = teaserOpenAt(event.event_date);
            if (!openAt) return null;
            return (
              <TeaserEventCard
                key={event.id}
                title={event.number ? `OKTAGON ${event.number}` : event.name}
                location={event.location}
                eventDateIso={event.event_date}
                openAtIso={openAt}
                imageUrl={event.image_url}
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
                "relative flex min-h-[160px] justify-between overflow-hidden rounded-xl border p-4 shadow-lg shadow-black/20 transition-shadow hover:shadow-xl dark:shadow-black/60",
                event.image_url
                  ? "items-end border-neutral-800 hover:border-neutral-600"
                  : "items-center border-white/45 bg-white/35 backdrop-blur-lg hover:border-white/80 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:hover:border-neutral-500/80"
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
              <Badge
                className="relative z-10"
                variant={effectiveStatus === "upcoming" ? "accent" : "secondary"}
              >
                {STATUS_LABELS[effectiveStatus]}
              </Badge>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
