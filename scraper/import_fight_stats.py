"""Post-fight tracking stats (hits, significant hits, takedowns, submission
attempts) for the fights of one gala, stored in `fight_stats`.

The data comes from the external system oktagonmma.com's own fight-statistics
widget uses - not from api.oktagonmma.com - so this is best-effort by design:
a fight that isn't there, or a system that's down, leaves no row and no error.
Which key a fight is found under depends on its age (see ESPORTS_EXPORT_URL);
one without either key cannot be asked about at all.

It only ever runs after a gala is over, which is also when the numbers first
exist - there is nothing here that could help anybody's tip.
"""

import argparse
from datetime import datetime, timezone

from oktagon import fetch_match_stats_by_key, summarize_match_stats
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
            # PostgREST "or": stačí jeden z klíčů, starší zápasy mají jen ten
            # druhý. Zápas bez obou se nemá čím zeptat.
            "or": "(oktagon_esports_id.not.is.null,oktagon_legacy_id.not.is.null)",
            "status": "in.(completed,no_contest)",
            "select": "id,oktagon_esports_id,oktagon_legacy_id,fighter_a_id,fighter_b_id",
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
        payload = fetch_match_stats_by_key(
            fight.get("oktagon_esports_id"), fight.get("oktagon_legacy_id")
        )
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
                f"Statistiky zápasu {fight['id']} nejdou spárovat "
                f"na {fighter_a.get('name')} vs {fighter_b.get('name')}, přeskakuji."
            )
            missing += 1
            continue

        rows.append(
            {
                **summary,
                "fight_id": fight["id"],
                # Id trackovacího systému z jeho vlastní odpovědi. U starých
                # zápasů se ptáme jeho `externalId` (naše oktagon_legacy_id),
                # ale uložit chceme to, pod čím si zápas vede on sám - jinak
                # by v jednom sloupci byla dvě různá číslování.
                "esports_match_id": (summary.get("esports_match_id") or fight.get("oktagon_esports_id")),
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
