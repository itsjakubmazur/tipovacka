import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Beer } from "lucide-react";
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
import { SegmentedControl } from "@/components/ui/segmented-control";

// Deliberately about the *tipping* state, not the gala's - matching the
// status timeline on the event detail ("Tipování otevřené" -> "Tipování
// uzamčeno" -> "Vyhodnoceno"). "Chystá se" used to sit here and contradicted
// it. (The admin list keeps its own labels: admins think in record states.)
const STATUS_LABELS: Record<string, string> = {
  draft: "Návrh",
  upcoming: "Otevřeno",
  locked: "Uzamčeno",
  completed: "Vyhodnoceno",
  // Archivní turnaje jsme netipovali, takže nemají co vyhodnocovat - mají
  // jen výsledky. Badge to musí říct, jinak karta předstírá stav tipování.
  archive: "Archiv",
};

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ sezona?: string }>;
}) {
  const supabase = await createClient();
  const { sezona } = await searchParams;

  // Every gala plus its fight count is identical for every viewer - served
  // from the cached shell in parallel with auth, rather than waiting on it.
  // Drafts are included here and filtered per-viewer below (showDrafts).
  const [{ data: userData }, { events, fightCounts }] = await Promise.all([
    supabase.auth.getUser(),
    getEventsListShared(),
  ]);
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  let showDrafts = false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (profile?.is_superadmin) {
    const cookieStore = await cookies();
    showDrafts = cookieStore.get(VIEW_MODE_COOKIE)?.value === "admin";
  }

  // Counted in the database, one row per gala. Doing it here in JS meant
  // fetching every fight ever imported plus every prediction the viewer has
  // made, which PostgREST truncates at 1000 rows - around the 90th gala the
  // counters would have started silently under-reporting.
  const { data: tipCounts } = await supabase
    .from("event_user_tip_counts")
    .select("event_id, tipped")
    .eq("user_id", user.id);

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

  // One listing, one season at a time. Eleven years of OKTAGON in a single
  // scroll is unusable, and seasons are how the leaderboard already talks
  // about time - same control, same vocabulary.
  const seasonOf = (iso: string) => new Date(iso).getFullYear();
  const seasons = Array.from(new Set((events ?? []).map((e) => seasonOf(e.event_date)))).sort(
    (a, b) => b - a
  );
  const requested = sezona ? Number(sezona) : NaN;
  // Defaults to the newest season, the one being tipped - nobody opening
  // this page is looking for 2016.
  const season = seasons.includes(requested) ? requested : (seasons[0] ?? now.getFullYear());
  const seasonEvents = (events ?? []).filter((e) => seasonOf(e.event_date) === season);

  // Prefetch targets are only the real, tappable cards - never a draft
  // (its detail 404s for tippers), so compute over the published set.
  // The archive never leads: it has no tipping state to be current about.
  const published = (events ?? []).filter((e) => e.status !== "draft" && !e.is_archive);
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
    (e) => e.status !== "draft" && e.status !== "completed" && !e.is_archive
  );
  const teaserDraft = activeGalaExists
    ? null
    : (events ?? [])
        .filter(
          (e) =>
            e.status === "draft" &&
            !e.is_archive &&
            e.event_date &&
            now.getTime() < new Date(cardOpensAtIso(e.event_date)).getTime()
        )
        .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())[0] ?? null;

  // Co se ze sezóny opravdu vykreslí - drafty vidí jen admin v admin-view
  // (plus ten jeden v teaser okně), tak ať čítač v eyebrow nelže.
  const visible = seasonEvents.filter(
    (e) => e.status !== "draft" || showDrafts || e.id === teaserDraft?.id
  );

  return (
    <div className="stagger-in flex flex-col gap-4 px-4 py-8">
      <PageHeading
        eyebrow={`Sezóna ${season} · ${visible.length} ${
          visible.length === 1 ? "galavečer" : visible.length <= 4 ? "galavečery" : "galavečerů"
        }`}
      >
        Galavečery
      </PageHeading>

      {seasons.length > 1 && (
        <SegmentedControl
          ariaLabel="Sezóna"
          value={String(season)}
          segments={seasons.map((year) => ({
            key: String(year),
            label: String(year),
            href: `/events?sezona=${year}`,
          }))}
        />
      )}

      {user && <WelcomeCard />}

      {!seasonEvents.length && (
        <div className="glass-surface rounded-xl border p-6 text-center text-neutral-600 dark:text-neutral-400">
          Žádné galavečery zatím nejsou.
        </div>
      )}

      <div className={cn("flex flex-col gap-3", "lg:grid lg:grid-cols-3 lg:gap-4")}>
        {seasonEvents.map((event, index) => {
          // Archiv se do výpisu neodděluje - jen se v něm ohlásí. Předěl
          // patří před první archivní kartu sezóny: v roce, kdy tipovačka
          // začala, vyjde mezi OKTAGON 90 a 89, ve starších sezónách rovnou
          // nahoru nad celý ročník.
          const prev = index > 0 ? seasonEvents[index - 1] : null;
          const startsArchive = event.is_archive && (!prev || !prev.is_archive);
          const divider = startsArchive ? (
            <div className="mt-2 flex items-center gap-3 lg:col-span-3">
              <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
              <span className="shrink-0 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Archiv OKTAGONU · tyhle turnaje jsme netipovali
              </span>
              <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
            </div>
          ) : null;

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
          const effectiveStatus = event.is_archive
            ? "archive"
            : event.status === "draft"
              ? "draft"
              : event.status === "completed"
                ? "completed"
                : locked
                  ? "locked"
                  : "upcoming";
          const totalFights = fightCountByEvent.get(event.id) ?? 0;
          const tippedCount = predictionCountByEvent.get(event.id) ?? 0;
          // Sledovačka se hlásí u každého stavu kromě vyhodnoceného, ale
          // stavový badge se renderuje ve dvou větvích (s odpočtem a bez),
          // tak ať se pill nepíše dvakrát.
          const watchPartyPill =
            event.watch_party_enabled && effectiveStatus !== "completed" ? (
              <Badge variant="info" className="w-fit gap-1">
                <Beer className="size-3.5 shrink-0" aria-hidden />
                Koukáme v garáži
              </Badge>
            ) : null;
          return (
            <Fragment key={event.id}>
              {divider}
              <Link
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
                    <div className="mt-1 flex flex-col gap-1">
                      <p className={cn("text-sm", event.image_url ? "text-white/70" : "text-neutral-500 dark:text-neutral-300")}>
                        Tipnuto {tippedCount} z {totalFights} zápasů
                      </p>
                      <div
                        className={cn(
                          "h-1 w-28 overflow-hidden rounded-full",
                          event.image_url ? "bg-white/25" : "bg-black/10 dark:bg-white/15"
                        )}
                        role="progressbar"
                        aria-valuenow={tippedCount}
                        aria-valuemin={0}
                        aria-valuemax={totalFights}
                        aria-label={`Tipnuto ${tippedCount} z ${totalFights} zápasů`}
                      >
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${Math.round((tippedCount / totalFights) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                {/* Pod stavovým badgem, ne v levém sloupci: obojí je stav
                    galavečera, tak patří k sobě - a pill v levém sloupci
                    přidával kartě řádek navíc. Změřeno na 320/360/390/430:
                    od 360 výš se text vlevo láme úplně stejně a karta je o
                    31 px nižší. Na 320 je to výměna (adresa si vezme třetí
                    řádek), ale i tam vyjde karta nižší než dřív, kdy se
                    místo toho lámal na dva řádky sám pill. */}
                {effectiveStatus === "upcoming" && event.lock_at ? (
                  <TippingStatus lockAtIso={event.lock_at} onImage={Boolean(event.image_url)}>
                    {watchPartyPill}
                  </TippingStatus>
                ) : (
                  // self-stretch, aby stavový badge seděl nahoře stejně jako
                  // v TippingStatus. Bez něj ho items-end na kartě stáhne dolů
                  // a badge skáče podle toho, jestli má galavečer odpočet.
                  <div className="relative z-10 flex shrink-0 flex-col items-end gap-1.5 self-stretch">
                    <Badge
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
                    {watchPartyPill}
                  </div>
                )}
              </Link>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
