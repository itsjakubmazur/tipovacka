import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { extraTagsForTable } from "@/lib/revalidate-tags";

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
  const extra = table ? extraTagsForTable(table, tag) : [];
  const revalidated = [tag, ...extra];
  for (const t of revalidated) {
    revalidateTag(t, IMMEDIATE);
  }

  return Response.json({ revalidated });
}
