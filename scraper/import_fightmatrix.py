"""Import Fight Matrix rank + score for every fighter on an event's card.

Usage:
    python import_fightmatrix.py --event-id <uuid>

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
The event row must already have fightmatrix_event_url set, and the card
must already be imported (fighters/fights exist for the event).
"""

import argparse
import sys
import unicodedata

from fightmatrix import parse_event, parse_fighter
from supabase_client import SupabaseClient


def normalize_name(name: str) -> str:
    decomposed = unicodedata.normalize("NFKD", name)
    return "".join(c for c in decomposed if not unicodedata.combining(c)).lower().strip()


def import_fightmatrix(event_id: str) -> None:
    db = SupabaseClient()

    events = db.select("events", {"id": f"eq.{event_id}", "select": "id,fightmatrix_event_url"})
    if not events:
        print(f"Event {event_id} nenalezen.")
        sys.exit(1)

    fightmatrix_url = events[0].get("fightmatrix_event_url")
    if not fightmatrix_url:
        print("Event nemá vyplněnou fightmatrix_event_url.")
        sys.exit(1)

    fights = db.select(
        "fights",
        {
            "event_id": f"eq.{event_id}",
            "select": (
                "fighter_a:fighters!fights_fighter_a_id_fkey(id,name),"
                "fighter_b:fighters!fights_fighter_b_id_fkey(id,name)"
            ),
        },
    )
    fighters_by_name = {}
    for fight in fights:
        for fighter in (fight["fighter_a"], fight["fighter_b"]):
            fighters_by_name[normalize_name(fighter["name"])] = fighter

    if not fighters_by_name:
        print("Event nemá žádné zápasy v DB, nejdřív naimportuj kartu ze Sherdogu.")
        sys.exit(1)

    scraped = parse_event(fightmatrix_url)
    if not scraped:
        print("Na Fight Matrix stránce eventu jsem nenašel žádné zápasníky.")
        sys.exit(1)

    updated = 0
    for entry in scraped:
        fighter = fighters_by_name.get(normalize_name(entry["name"]))
        if not fighter:
            print(f"Nenašel jsem v DB zápasníka {entry['name']}, přeskakuji.")
            continue

        data = parse_fighter(entry["profile_url"])
        if not data:
            print(f"{entry['name']}: Fight Matrix nemá žádnou historii ranku, přeskakuji.")
            continue

        db.update(
            "fighters",
            {
                "fightmatrix_url": entry["profile_url"],
                "fightmatrix_rank": data["rank"],
                "fightmatrix_score": data["score"],
            },
            {"id": f"eq.{fighter['id']}"},
        )
        updated += 1
        print(f"{entry['name']}: {data['rank']} ({data['score']} bodů)")

    print(f"Hotovo, aktualizováno {updated} zápasníků.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--event-id", required=True)
    args = parser.parse_args()
    import_fightmatrix(args.event_id)
