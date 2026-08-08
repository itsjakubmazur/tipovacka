import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const REPO = "itsjakubmazur/tipovacka";
const WORKFLOW = "scraper-cron.yml";

// Checked at cron-job.org level: hit this URL instead of GitHub directly.
// We gate on CRON_SECRET so arbitrary traffic can't drive up GitHub API usage.
function checkSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("Authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

// Service-role Supabase client — bypasses RLS, same as the scraper.
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Dispatch the scraper cron workflow via GitHub API.
async function dispatch(token: string): Promise<boolean> {
  const resp = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main" }),
    }
  );
  return resp.ok;
}

// Returns the first reason we need to run the scraper right now, or null if
// there is genuinely nothing to do. Mirrors the conditions in cron.py without
// re-implementing all the logic — just the cheapest DB signals.
async function findPendingWork(): Promise<string | null> {
  const db = serviceClient();
  const now = new Date().toISOString();
  // 90 minutes from now — gives enough runway to send the reminder on time
  const soon = new Date(Date.now() + 90 * 60 * 1000).toISOString();

  // 1. Card not imported yet (grace period already passed)
  {
    const { data } = await db
      .from("events")
      .select("id")
      .eq("status", "upcoming")
      .is("card_notified_at", null)
      .not("number", "is", null)
      .lte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(1);
    if (data?.length) return "card pending import";
  }

  // 2. Lock reminder due within 90 min (check every few minutes, not every 3h)
  {
    const { data } = await db
      .from("events")
      .select("id")
      .not("status", "in", '("draft","completed")')
      .is("reminder_sent_at", null)
      .lte("lock_at", soon)
      .gt("lock_at", now)
      .limit(1);
    if (data?.length) return "lock reminder pending";
  }

  // 3. Lock notification not yet sent (gala has started)
  {
    const { data } = await db
      .from("events")
      .select("id")
      .not("status", "in", '("draft","completed")')
      .is("lock_notified_at", null)
      .lte("lock_at", now)
      .limit(1);
    if (data?.length) return "lock notification pending";
  }

  // 4. Results to check (event locked, not yet completed)
  {
    const { data } = await db
      .from("events")
      .select("id")
      .not("status", "in", '("draft","completed")')
      .lte("lock_at", now)
      .not("number", "is", null)
      .limit(1);
    if (data?.length) return "results pending";
  }

  // 5. Unnotified comment
  {
    const { data } = await db
      .from("event_comments")
      .select("id")
      .is("notified_at", null)
      .eq("is_system", false)
      .limit(1);
    if (data?.length) return "comment notification pending";
  }

  // 6. Card recheck overdue (unlocked event, not checked in 3h)
  {
    const stale = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const { data } = await db
      .from("events")
      .select("id")
      .not("status", "in", '("draft","completed")')
      .gt("lock_at", now)
      .or(`card_checked_at.is.null,card_checked_at.lte.${stale}`)
      .limit(1);
    if (data?.length) return "card recheck overdue";
  }

  // 7. Heartbeat gap: scraper hasn't run in 10 min → force a run so the
  //    30-min alert in cron.py doesn't fire when there's legitimately nothing
  //    to do but the heartbeat still needs updating.
  {
    const threshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data } = await db
      .from("cron_heartbeat")
      .select("last_run_at")
      .lte("last_run_at", threshold)
      .limit(1);
    if (data?.length) return "heartbeat gap";
  }

  return null;
}

export async function GET(request: NextRequest) {
  if (!checkSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return Response.json({ error: "GITHUB_DISPATCH_TOKEN not configured" }, { status: 500 });
  }

  let reason: string | null;
  try {
    reason = await findPendingWork();
  } catch (err) {
    return Response.json({ error: `DB query failed: ${err}` }, { status: 500 });
  }

  if (!reason) {
    return Response.json({ dispatch: false, reason: "nothing to do" });
  }

  const ok = await dispatch(token);
  if (!ok) {
    return Response.json({ error: "GitHub dispatch failed" }, { status: 502 });
  }

  return Response.json({ dispatch: true, reason });
}
