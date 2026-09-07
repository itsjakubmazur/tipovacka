import { createClient } from "@/lib/supabase/client";
import type { WatchPartyAnswer } from "@/lib/watch-party";

/** Jediná zapisovací cesta pro odpověď na sledovačku.
 *
 * `async` schválně, ne pro parádu: PostgREST builder je líný thenable -
 * request se poskládá a odešle teprve uvnitř `then()`. Když se builder jen
 * zahodí (`void supabase.from(...).upsert(...)`), neodejde vůbec nic a
 * odpověď zůstane žít jen ve stavu Reactu, dokud uživatel neodejde ze
 * stránky. Návrat z async funkce ten thenable dořeší (a `persist-rsvp.test.ts`
 * to hlídá). */
export async function persistRsvp(input: {
  eventId: string;
  userId: string;
  answer: WatchPartyAnswer;
  plusOnes: number;
}) {
  const supabase = createClient();
  return supabase.from("watch_party_rsvps").upsert(
    {
      event_id: input.eventId,
      user_id: input.userId,
      answer: input.answer,
      plus_ones: input.plusOnes,
    },
    { onConflict: "event_id,user_id" }
  );
}
