"""Post-fight tracking stats (hits, significant hits, takedowns, submission
attempts) for the fights of one gala, stored in `fight_stats`.

The data comes from the external system oktagonmma.com's own fight-statistics
widget uses - not from api.oktagonmma.com - so this is best-effort by design:
a fight that isn't there, or a system that's down, leaves no row and no error.
Anything before roughly mid-2024 has no `esportsId` at all.

It only ever runs after a gala is over, which is also when the numbers first
exist - there is nothing here that could help anybody's tip.
"""

import argparse
from datetime import datetime, timezone

from oktagon import fetch_match_stats, summarize_match_stats
from run_logger import log_run
from supabase_client import SupabaseClient


def import_fight_stats(event_id: str) -> int:
    """Returns how many fights got stats. Never raises on a missing fight -
    the whole source is optional."""
    db = SupabaseClient()

    fights = db.select(
        "fights",
        {
            "event_id": f"eq.{event_id}",
            "oktagon_esports_id": "not.is.null",
            "status": "in.(completed,no_contest)",
            "select": "id,oktagon_esports_id,fighter_a_id,fighter_b_id",
        },
    )
    if not fights:
        print("Žádný odehraný zápas s napojením na statistiky.")
        return 0

    fighter_ids = {f[side] for f in fights for side in ("fighter_a_id", "fighter_b_id") if f[side]}
    fighter_rows = db.select(
        "fighters",
        {"id": f"in.({','.join(sorted(fighter_ids))})", "select": "id,name,oktagon_legacy_id"},
    )
    fighters = {row["id"]: row for row in fighter_rows}

    now = datetime.now(timezone.utc).isoformat()
    rows = []
    missing = 0
    for fight in fights:
        payload = fetch_match_stats(fight["oktagon_esports_id"])
        if not payload:
            missing += 1
            continue

        fighter_a = fighters.get(fight["fighter_a_id"]) or {}
        fighter_b = fighters.get(fight["fighter_b_id"]) or {}
        summary = summarize_match_stats(payload, fighter_a, fighter_b)
        if not summary:
            # Neither the legacy id nor the name lined up, so we cannot tell
            # whose punches are whose. Better no stats than mirrored ones.
            print(
                f"Statistiky zápasu {fight['oktagon_esports_id']} nejdou spárovat "
                f"na {fighter_a.get('name')} vs {fighter_b.get('name')}, přeskakuji."
            )
            missing += 1
            continue

        rows.append(
            {
                **summary,
                "fight_id": fight["id"],
                # Ours is the id we asked for, not whatever the payload echoes.
                "esports_match_id": fight["oktagon_esports_id"],
                "fetched_at": now,
            }
        )

    if rows:
        db.upsert("fight_stats", rows, on_conflict="fight_id")

    print(f"Statistiky uloženy u {len(rows)} zápasů, u {missing} nejsou k dispozici.")
    return len(rows)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--event-id", required=True)
    args = parser.parse_args()

    with log_run("fight_stats", args.event_id):
        import_fight_stats(args.event_id)
