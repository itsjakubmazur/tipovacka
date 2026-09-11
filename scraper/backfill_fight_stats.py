"""Fills post-fight stats for galas that are already over.

Two steps, because a finished card never gets re-imported: first the fights
get their `oktagon_esports_id` (only ever written while a card is being
imported, so anything from before that column existed has none), then
import_fight_stats does the actual fetching.

Touches nothing but that one column - no results, no statuses, no scoring.
The external tracking system only goes back to roughly mid-2024, so a gala
older than that will simply find no ids and no stats.
"""

import argparse

from import_fight_stats import import_fight_stats
from oktagon import fetch_fightcard, resolve_event_id
from run_logger import log_run
from supabase_client import SupabaseClient


def backfill_event(db: SupabaseClient, event: dict) -> tuple[int, int]:
    """Returns (how many fights got an id, how many got stats)."""
    label = f"OKTAGON {event['number']}" if event.get("number") else event["name"]

    oktagon_event_id = resolve_event_id(db, event)
    if not oktagon_event_id:
        print(f"{label}: chybí id v OKTAGON API, přeskakuji.")
        return 0, 0

    fights_in_db = db.select(
        "fights",
        {
            "event_id": f"eq.{event['id']}",
            "oktagon_fight_id": "not.is.null",
            "select": "id,oktagon_fight_id,oktagon_esports_id",
        },
    )
    if not fights_in_db:
        print(f"{label}: žádné zápasy napojené na OKTAGON API.")
        return 0, 0

    try:
        card = fetch_fightcard(oktagon_event_id)
    except Exception as exc:
        print(f"{label}: kartu se nepodařilo stáhnout ({exc}), přeskakuji.")
        return 0, 0

    esports_by_fight = {
        fight["oktagon_fight_id"]: fight["oktagon_esports_id"]
        for fight in card
        if fight.get("oktagon_esports_id")
    }

    linked = 0
    for db_fight in fights_in_db:
        esports_id = esports_by_fight.get(db_fight["oktagon_fight_id"])
        if not esports_id or db_fight.get("oktagon_esports_id") == esports_id:
            continue
        db.update(
            "fights", {"oktagon_esports_id": esports_id}, {"id": f"eq.{db_fight['id']}"}
        )
        linked += 1

    print(f"{label}: doplněno {linked} napojení na statistiky.")
    return linked, import_fight_stats(event["id"])


def backfill_fight_stats(event_id: str | None = None) -> None:
    db = SupabaseClient()

    filters = {
        "status": "eq.completed",
        "select": "id,number,name,oktagon_event_id",
        "order": "event_date.desc",
    }
    if event_id:
        filters = {"id": f"eq.{event_id}", "select": "id,number,name,oktagon_event_id"}

    events = db.select("events", filters)
    if not events:
        print("Žádný odehraný galavečer k doplnění.")
        return

    linked_total = 0
    stats_total = 0
    for event in events:
        linked, stats = backfill_event(db, event)
        linked_total += linked
        stats_total += stats

    print(
        f"Hotovo: napojeno {linked_total} zápasů, statistiky uloženy "
        f"u {stats_total} z nich."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--event-id", help="jen tenhle galavečer (jinak všechny odehrané)")
    args = parser.parse_args()

    with log_run("fight_stats_backfill", args.event_id):
        backfill_fight_stats(args.event_id)
