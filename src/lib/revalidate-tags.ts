/** Extra cache tags to bust when a given table changes.
 *
 * The webhook only knows the row's event-scoped tag; this fan-out is
 * the rest of the pages that same write invalidates. Kept pure so it
 * can be unit-tested without Next. */
export function extraTagsForTable(table: string, tag: string): string[] {
  const extra: string[] = [];
  if (table === "events" || table === "fights") {
    extra.push("events-list", "leaderboard-global");
  }
  if (table === "predictions" || table === "bold_picks" || table === "bonus_predictions") {
    extra.push(tag.replace(/^event-/, "leaderboard-event-"), "leaderboard-global", "hall-of-fame");
  }
  return extra;
}
