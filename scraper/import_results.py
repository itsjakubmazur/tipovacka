"""Import results for an already-carded event from Sherdog and recalculate
points.

Usage:
    python import_results.py --event-id <uuid>

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
"""

import argparse
import sys

from run_logger import log_run
from sherdog import parse_event
from supabase_client import SupabaseClient


def import_results(event_id: str) -> None:
    db = SupabaseClient()

    events = db.select("events", {"id": f"eq.{event_id}", "select": "id,sherdog_event_url"})
    if not events:
        print(f"Event {event_id} nenalezen.")
        sys.exit(1)

    sherdog_url = events[0].get("sherdog_event_url")
    if not sherdog_url:
        print("Event nemá vyplněnou sherdog_event_url.")
        sys.exit(1)

    data = parse_event(sherdog_url)

    fights_in_db = db.select(
        "fights",
        {
            "event_id": f"eq.{event_id}",
            "select": (
                "id,fighter_a_id,fighter_b_id,"
                "fighter_a:fighters!fights_fighter_a_id_fkey(name),"
                "fighter_b:fighters!fights_fighter_b_id_fkey(name)"
            ),
        },
    )

    by_names = {}
    for fight in fights_in_db:
        key = frozenset([fight["fighter_a"]["name"].lower(), fight["fighter_b"]["name"].lower()])
        by_names[key] = fight

    updated = 0
    for scraped in data["fights"]:
        if not scraped.get("winner_name") or not scraped.get("method"):
            continue

        key = frozenset([scraped["fighter_a"]["name"].lower(), scraped["fighter_b"]["name"].lower()])
        fight = by_names.get(key)
        if not fight:
            print(
                f"Nenašel jsem v DB zápas {scraped['fighter_a']['name']} vs "
                f"{scraped['fighter_b']['name']}, přeskakuji."
            )
            continue

        winner_is_a = scraped["winner_name"].lower() == fight["fighter_a"]["name"].lower()
        winner_id = fight["fighter_a_id"] if winner_is_a else fight["fighter_b_id"]

        db.update(
            "fights",
            {
                "status": "completed",
                "winner_fighter_id": winner_id,
                "method": scraped["method"],
                "result_round": scraped.get("round") if scraped["method"] != "DECISION" else None,
            },
            {"id": f"eq.{fight['id']}"},
        )
        updated += 1
        print(f"Uložen výsledek: {scraped['fighter_a']['name']} vs {scraped['fighter_b']['name']} -> {scraped['method']}")

    if updated:
        db.rpc("recalculate_event_points", {"p_event_id": event_id})
        print(f"Přepočítány body pro {updated} zápasů.")
    else:
        print("Žádné nové výsledky k uložení (Sherdog je možná ještě nemá zveřejněné).")

    remaining = db.select(
        "fights",
        {"event_id": f"eq.{event_id}", "status": "eq.scheduled", "select": "id"},
    )
    if not remaining:
        db.update("events", {"status": "completed"}, {"id": f"eq.{event_id}"})
        print("Všechny zápasy odehrané, galavečer označen jako vyhodnocený.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--event-id", required=True)
    args = parser.parse_args()
    with log_run("results", args.event_id):
        import_results(args.event_id)
