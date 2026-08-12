import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

// Same shared-secret pattern as /api/cron-tick - called by a Supabase DB
// webhook (see supabase/migrations/20260741000000_revalidation_webhooks.sql),
// never directly by a browser.
function checkSecret(request: NextRequest): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("Authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!checkSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { table?: string; tag?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { table, tag } = body;
  if (!tag) {
    return Response.json({ error: "missing tag" }, { status: 400 });
  }

  // { expire: 0 } expires the tag immediately rather than marking it merely
  // stale - this route exists specifically for a webhook that needs the
  // next visit to see fresh data right away, not eventually-consistent
  // stale-while-revalidate semantics.
  const IMMEDIATE = { expire: 0 } as const;
  const revalidated = [tag];
  revalidateTag(tag, IMMEDIATE);

  // A single write can affect more than one cached view. The DB trigger only
  // knows which row changed (-> one event-scoped tag); this route owns the
  // fan-out to whichever other cached pages that same table backs, so the
  // trigger SQL doesn't need to guess every downstream consumer.
  if (table === "events" || table === "fights") {
    revalidateTag("events-list", IMMEDIATE);
    revalidateTag("leaderboard-global", IMMEDIATE);
    revalidated.push("events-list", "leaderboard-global");
  }
  if (table === "predictions" || table === "bold_picks" || table === "bonus_predictions") {
    const leaderboardTag = tag.replace(/^event-/, "leaderboard-event-");
    // Season/history views aggregate across events rather than keying off
    // one, so they share the coarser "leaderboard-global" tag instead of a
    // per-season one - the DB trigger only knows the event, not the season.
    revalidateTag(leaderboardTag, IMMEDIATE);
    revalidateTag("leaderboard-global", IMMEDIATE);
    revalidateTag("hall-of-fame", IMMEDIATE);
    revalidated.push(leaderboardTag, "leaderboard-global", "hall-of-fame");
  }

  return Response.json({ revalidated });
}
