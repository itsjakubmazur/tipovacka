import { Suspense } from "react";
import Image from "next/image";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEventShared } from "@/lib/data/event-detail";
import { VIEW_MODE_COOKIE } from "@/lib/view-mode";
import { SegmentJump } from "@/components/predictions/segment-jump";
import { PersonalizedEventData } from "@/components/events/personalized-event-data";
import { EventDetailSkeleton } from "@/components/events/event-detail-skeleton";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { perfStart, perfLogParts } from "@/lib/perf";
import type { Fight } from "@/lib/types";
import { PageHeading } from "@/components/ui/page-heading";

const CARD_SEGMENT_LABELS: Record<NonNullable<Fight["card_segment"]>, string> = {
  main_card: "Hlavní karta",
  prelims: "Prelims",
  free_prelims: "Free Prelims",
};

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const perf = perfStart();

  // The shared shell (event row, fight card, comments, standings) comes
  // from a cached fetch keyed on the event id - instant on repeat nav,
  // busted server-side by /api/internal/revalidate whenever a write
  // touches this event. Auth can't be cached (it's cookie-bound and
  // security-relevant), so it still runs live, in parallel.
  const [{ event, fights, comments, finalStandings, allPredictions }, { data: userData }, cookieStore] =
    await Promise.all([getEventShared(id), supabase.auth.getUser(), cookies()]);
  const perfShared = perfStart();

  if (!event) {
    notFound();
  }
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const locked =
    event.status === "completed" ||
    (event.lock_at ? new Date(event.lock_at) <= new Date() : false);

  // Draft galas are only visible to admins - that check needs the caller's
  // profile, which is per-user and therefore fetched inside the
  // personalized/Suspense half below, but a non-admin must never even see a
  // draft's shell. Fall back to a live single-row check here (cheap - one
  // indexed lookup) rather than caching admin status globally.
  if (event.status === "draft") {
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!profile?.is_admin) {
      notFound();
    }
  }

  const { rows: fightsWithHeaders } = fights
    .filter((f) => f.status !== "cancelled")
    .reduce<{
      rows: { fight: Fight; showSegmentHeader: boolean }[];
      lastSegment: Fight["card_segment"];
    }>(
      (acc, fight) => {
        const showSegmentHeader = Boolean(fight.card_segment && fight.card_segment !== acc.lastSegment);
        return {
          rows: [...acc.rows, { fight, showSegmentHeader }],
          lastSegment: fight.card_segment ?? acc.lastSegment,
        };
      },
      { rows: [], lastSegment: null }
    );

  const cancelledFights = fights.filter((f) => f.status === "cancelled");

  const segmentsOnCard = fightsWithHeaders
    .filter(({ showSegmentHeader }) => showSegmentHeader)
    .map(({ fight }) => ({
      key: fight.card_segment!,
      label: CARD_SEGMENT_LABELS[fight.card_segment!],
    }));

  // The cancelled block is a section of the card like any other, so it gets
  // a pill too - otherwise the bar quietly stops working two thirds down the
  // page, right where you'd most want it.
  const jumpSegments =
    cancelledFights.length > 0
      ? [...segmentsOnCard, { key: "cancelled", label: "Zrušené zápasy" }]
      : segmentsOnCard;

  // "11.07.2026 | KÖLN | LANXESS ARENA" - the poster's own line, in the
  // poster's own order. Our location is stored venue-first ("Lanxess Arena,
  // Köln"), so the parts get reversed; OKTAGON's API also calls Prague
  // "Hlavní město Praha", where the poster just says PRAHA.
  const posterLine = [
    new Date(event.event_date)
      .toLocaleDateString("cs-CZ", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Europe/Prague",
      })
      .replace(/\s/g, ""),
    ...String(event.location ?? "")
      .split(",")
      .map((part: string) => part.trim().replace(/^Hlavní město\s+/i, ""))
      .filter(Boolean)
      .reverse(),
  ].join(" | ");

  perfLogParts(`event/${id}`, {
    w1_shared: perfShared - perf,
    total: perfShared - perf,
  });

  return (
    <div className="stagger-in flex flex-col gap-4 px-4 py-8">
      {/* One watcher for all three tables, so a burst of changes costs one
          refresh. While the gala is running it also polls: results arrive in
          exactly the minutes when a phone is most likely to have been asleep,
          backgrounded or on arena wifi, and none of those deliver a socket
          event. Outside that window there's nothing to poll for. This also
          busts the cached shell above on the next request, complementing
          (not replacing) the DB-webhook-driven revalidation. */}
      <RealtimeRefresh
        tables={["fights", "predictions", "event_payouts"]}
        pollMs={locked && event.status !== "completed" ? 45_000 : undefined}
      />
      {/* The poster stays untouched. Laying the title over it cost more than
          it saved: OKTAGON prints the date, the venue, its own logo and the
          sponsor row into the bottom third of the artwork, which is exactly
          where the type had to go, and the scrim needed to carry white text
          drowned all of it. */}
      {event.image_url && (
        <div className="relative -mx-4 -mt-8 aspect-[16/9] overflow-hidden sm:mx-0 sm:mt-0 sm:rounded-xl lg:aspect-[21/8]">
          <Image
            src={event.image_url}
            alt={event.number ? `OKTAGON ${event.number}` : event.name}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-background" />
        </div>
      )}

      {/* The poster prints the same date and venue into the artwork, so this
          line does repeat it - kept anyway: it's one row, it reads far better
          than 8pt type inside a photo, and it's the only version that's there
          for a gala without a poster, in a screen reader, or when the image
          hasn't loaded. */}
      <PageHeading eyebrow={posterLine}>
        {event.number ? `OKTAGON ${event.number}` : event.name}
        {event.subtitle && (
          <span className="ml-2 text-sm font-semibold text-yellow-600 lg:text-base dark:text-accent">
            {event.subtitle}
          </span>
        )}
      </PageHeading>

      {/* Desktop keeps the jump row above both columns: inside the fights
          column it would push the first fight card below the first card in
          the rail. On a phone the same row floats instead - it takes no
          layout at the top of the page, where you don't need it, and
          arrives as soon as you start scrolling the card. */}
      <SegmentJump segments={jumpSegments} className="hidden lg:flex" />
      <SegmentJump segments={jumpSegments} className="lg:hidden" floating />

      {/* Everything below needs the viewer's own predictions, rank and admin
          flags - fetched fresh per request, streamed in so the shell above
          (already resolved from cache) never waits on it. */}
      <Suspense fallback={<EventDetailSkeleton fightsCount={fightsWithHeaders.length} />}>
        <PersonalizedEventData
          eventId={id}
          userId={user.id}
          event={event}
          fights={fights}
          comments={comments}
          finalStandings={finalStandings}
          allPredictions={allPredictions}
          locked={locked}
          viewModeCookie={cookieStore.get(VIEW_MODE_COOKIE)?.value}
        />
      </Suspense>
    </div>
  );
}
