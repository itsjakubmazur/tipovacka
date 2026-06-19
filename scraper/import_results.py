"""Import results for an already-carded event from OKTAGON's API and
recalculate points.

Usage:
    python import_results.py --event-id <uuid>

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
"""

import argparse
import sys

from oktagon import fetch_fightcard, resolve_event_id
from run_logger import log_run
from supabase_client import SupabaseClient


def import_results(event_id: str) -> None:
    db = SupabaseClient()

    events = db.select("events", {"id": f"eq.{event_id}", "select": "id,number,oktagon_event_id"})
    if not events:
        print(f"Event {event_id} nenalezen.")
        sys.exit(1)
    event = events[0]

    oktagon_event_id = resolve_event_id(db, event)
    if not oktagon_event_id:
        print("Event nemá vyplněné číslo OKTAGONu, nebo se ho nepodařilo dohledat v OKTAGON API.")
        sys.exit(1)

    fights_data = fetch_fightcard(oktagon_event_id)

    fights_in_db = db.select(
        "fights",
        {"event_id": f"eq.{event_id}", "select": "id,oktagon_fight_id,fighter_a_id,fighter_b_id,status"},
    )
    by_oktagon_id = {f["oktagon_fight_id"]: f for f in fights_in_db if f.get("oktagon_fight_id")}

    updated = 0
    for fight in fights_data:
        if fight["status"] == "scheduled":
            continue

        db_fight = by_oktagon_id.get(fight["oktagon_fight_id"])
        if not db_fight:
            print(
                f"Nenašel jsem v DB zápas {fight['fighter_a']['name']} vs "
                f"{fight['fighter_b']['name']}, přeskakuji."
            )
            continue
        if db_fight["status"] != "scheduled":
            continue

        if fight["status"] == "no_contest":
            db.update("fights", {"status": "no_contest"}, {"id": f"eq.{db_fight['id']}"})
            updated += 1
            print(f"Zápas {fight['fighter_a']['name']} vs {fight['fighter_b']['name']} -> remíza / no contest.")
            continue

        winner_id = db_fight["fighter_a_id"] if fight["winner_side"] == "a" else db_fight["fighter_b_id"]
        db.update(
            "fights",
            {
                "status": "completed",
                "winner_fighter_id": winner_id,
                "method": fight["method"],
                "result_round": fight["result_round"],
                "result_time": fight["result_time"],
            },
            {"id": f"eq.{db_fight['id']}"},
        )
        updated += 1
        print(f"Uložen výsledek: {fight['fighter_a']['name']} vs {fight['fighter_b']['name']} -> {fight['method']}")

    if updated:
        db.rpc("recalculate_event_points", {"p_event_id": event_id})
        print(f"Přepočítány body pro {updated} zápasů.")
    else:
        print("Žádné nové výsledky k uložení (OKTAGON je možná ještě nemá zveřejněné).")

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
