"""Import Fight Matrix rank + score for every fighter on an event's card.

Usage:
    python import_fightmatrix.py --event-id <uuid>

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
The card must already be imported (fighters/fights exist for the event).
If the event has no fightmatrix_event_url yet, it's looked up by OKTAGON
number on Fight Matrix's upcoming-events listing and saved back to the
event row, so this only has to happen once per event.

Run automatically by import_card.py right after a card import; failures
here (e.g. event not found on Fight Matrix yet) are non-fatal so they
never block the card import itself.
"""

import argparse
import sys
import unicodedata

from fightmatrix import find_event_url, parse_event, parse_fighter
from run_logger import log_run
from supabase_client import SupabaseClient


def normalize_name(name: str) -> str:
    decomposed = unicodedata.normalize("NFKD", name)
    return "".join(c for c in decomposed if not unicodedata.combining(c)).lower().strip()


def import_fightmatrix(event_id: str) -> None:
    db = SupabaseClient()

    events = db.select("events", {"id": f"eq.{event_id}", "select": "id,number,fightmatrix_event_url"})
    if not events:
        print(f"Event {event_id} nenalezen.")
        sys.exit(1)

    event = events[0]
    fightmatrix_url = event.get("fightmatrix_event_url")
    if not fightmatrix_url:
        if not event.get("number"):
            print("Event nemá vyplněné číslo OKTAGONu, nejde dohledat na Fight Matrix.")
            return

        fightmatrix_url = find_event_url(event["number"])
        if not fightmatrix_url:
            print(f"OKTAGON {event['number']} jsem na Fight Matrix nenašel, zkusím to při dalším běhu.")
            return

        db.update("events", {"fightmatrix_event_url": fightmatrix_url}, {"id": f"eq.{event_id}"})
        print(f"Nalezena Fight Matrix stránka eventu: {fightmatrix_url}")

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
        return

    scraped = parse_event(fightmatrix_url)
    if not scraped:
        print("Na Fight Matrix stránce eventu jsem nenašel žádné zápasníky.")
        return

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
    with log_run("fightmatrix", args.event_id):
        import_fightmatrix(args.event_id)
