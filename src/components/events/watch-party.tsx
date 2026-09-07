import { Beer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { WatchPartyRsvp } from "@/components/events/watch-party-rsvp";
import {
  WATCH_PARTY_PLACE,
  headline,
  namesOf,
  summarize,
  type WatchPartyRow,
} from "@/lib/watch-party";

/** „Kdy“ pro hlavičku karty: „sobota 20:00“. Formátuje se na serveru a dolů
 * jde hotový řetězec - kdyby si ho počítal klient, lišil by se podle zóny
 * prohlížeče a React by to nahlásil jako hydration error (#418). */
function timeLabel(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("cs-CZ", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  });
}

/** Sledovačka u Rejdoše v garáži: kdo dorazí a kolik nás bude.
 *
 * Renderuje se jen když ji admin u galavečera zapnul. Po vyhodnocení už se
 * nedá odpovídat (hlídá RLS, ne jen tohle UI) a z karty zůstane jednořádková
 * vzpomínka na ten večer. */
export async function WatchParty({
  eventId,
  userId,
  nickname,
  startsAtIso,
  note,
  completed,
}: {
  eventId: string;
  userId: string;
  nickname: string;
  /** čas sledovačky, nebo začátek galavečera, když ho admin nevyplnil */
  startsAtIso: string | null;
  note: string | null;
  completed: boolean;
}) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("watch_party_rsvps")
    .select("user_id, answer, plus_ones, profiles(nickname)")
    .eq("event_id", eventId);

  const rows: WatchPartyRow[] = (
    (data ?? []) as unknown as {
      user_id: string;
      answer: WatchPartyRow["answer"];
      plus_ones: number;
      profiles: { nickname: string } | null;
    }[]
  )
    .map((r) => ({
      userId: r.user_id,
      nickname: r.profiles?.nickname ?? "Bez přezdívky",
      answer: r.answer,
      plusOnes: r.plus_ones,
    }))
    .sort((a, b) => a.nickname.localeCompare(b.nickname, "cs"));

  const when = timeLabel(startsAtIso);

  if (completed) {
    const summary = summarize(rows);
    return (
      <div className="flex flex-col gap-1 rounded-xl glass-surface border p-3.5">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Beer className="size-4 text-yellow-600 dark:text-accent" />
          Sledovačka
        </p>
        <p className="text-sm">{headline(summary, userId, true)}</p>
        {summary.yes.length > 0 && (
          <p className="text-xs text-neutral-600 dark:text-neutral-400">{namesOf(summary.yes)}</p>
        )}
      </div>
    );
  }

  return (
    <WatchPartyRsvp
      eventId={eventId}
      userId={userId}
      nickname={nickname}
      rows={rows}
      place={WATCH_PARTY_PLACE}
      when={when}
      note={note}
    />
  );
}
