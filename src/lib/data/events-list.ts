import { unstable_cache } from "next/cache";
import { createCachedClient } from "@/lib/supabase/cached";

// 5 minutes is a safety-net TTL in case a webhook delivery is ever lost -
// revalidateTag (fired from supabase/migrations/20260741000000_revalidation_webhooks.sql
// via /api/internal/revalidate, tag "events-list") is the primary invalidation path.
const SAFETY_NET_SECONDS = 300;

export type EventsListRow = {
  id: string;
  number: number | null;
  name: string;
  subtitle: string | null;
  event_date: string;
  location: string | null;
  status: string;
  lock_at: string | null;
  image_url: string | null;
};

/** Every gala (drafts included) plus each one's fight count - identical for
 * every viewer, draft visibility is filtered at render time per-viewer. */
export const getEventsListShared = unstable_cache(
  async (): Promise<{ events: EventsListRow[]; fightCounts: { event_id: string; fight_count: number }[] }> => {
    const supabase = createCachedClient();
    const [{ data: events }, { data: fightCounts }] = await Promise.all([
      supabase
        .from("events")
        .select("id, number, name, subtitle, event_date, location, status, lock_at, image_url")
        .order("event_date", { ascending: false }),
      supabase.from("event_fight_counts").select("event_id, fight_count"),
    ]);
    return { events: events ?? [], fightCounts: fightCounts ?? [] };
  },
  ["events-list-shared"],
  { tags: ["events-list"], revalidate: SAFETY_NET_SECONDS }
);
