"""Fills post-fight stats for galas that are already over.

Two steps, because a finished card never gets re-imported: first the fights
get their keys into the tracking system (only ever written while a card is
being imported, so anything from before those columns existed has none), then
import_fight_stats does the actual fetching.

Touches nothing but those two columns - no results, no statuses, no scoring.
Which key a fight is found under depends on its age (see ESPORTS_EXPORT_URL),
so both get filled in; a fight the tracking system never covered ends up with
neither, and simply has no stats.
"""

import argparse

from import_fight_stats import import_fight_stats
from oktagon import fetch_fightcard, resolve_event_id
from run_logger import log_run
from supabase_client import SupabaseClient


# Obě cesty do trackovacího systému - který klíč zápas má, záleží na jeho
# stáří (viz ESPORTS_EXPORT_URL v oktagon.py).
STATS_KEYS = ("oktagon_esports_id", "oktagon_legacy_id")


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
            "select": "id,oktagon_fight_id,oktagon_esports_id,oktagon_legacy_id",
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

    keys_by_fight = {fight["oktagon_fight_id"]: fight for fight in card}

    linked = 0
    for db_fight in fights_in_db:
        from_api = keys_by_fight.get(db_fight["oktagon_fight_id"])
        if not from_api:
            continue
        patch = {
            column: from_api.get(column)
            for column in STATS_KEYS
            if from_api.get(column) and db_fight.get(column) != from_api.get(column)
        }
        if not patch:
            continue
        db.update("fights", patch, {"id": f"eq.{db_fight['id']}"})
        linked += 1

    print(f"{label}: doplněno {linked} napojení na statistiky.")
    return linked, import_fight_stats(event["id"])


def backfill_fight_stats(event_id: str | None = None, year: int | None = None) -> None:
    db = SupabaseClient()

    filters = {
        "status": "eq.completed",
        "select": "id,number,name,oktagon_event_id",
        "order": "event_date.desc",
        # Archiv je taky odehraný a statistiky k němu existují - tenhle
        # skript je jediný, kdo mu je může doplnit. Přes sto turnajů se
        # ale do výchozího stropu PostgRESTu nevejde.
        "limit": "500",
    }
    if year:
        # Dvě podmínky na stejný sloupec musí do jednoho "and" - jako dva
        # klíče v dictu by druhá tu první přepsala.
        filters["and"] = f"(event_date.gte.{year}-01-01,event_date.lt.{year + 1}-01-01)"
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
    parser.add_argument(
        "--year",
        type=int,
        help="jen turnaje z téhle sezóny - archiv je přes sto turnajů a na jeden běh je to moc",
    )
    args = parser.parse_args()

    with log_run("fight_stats_backfill", args.event_id or (str(args.year) if args.year else None)):
        backfill_fight_stats(args.event_id, args.year)
