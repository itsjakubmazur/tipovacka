"""Import the fight card (fighters + fights) for an event from Sherdog.

Usage:
    python import_card.py --event-id <uuid>

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
The event row must already exist with sherdog_event_url set.
"""

import argparse
import sys

from sherdog import parse_event
from supabase_client import SupabaseClient


def upsert_fighter(db: SupabaseClient, fighter: dict) -> str:
    if fighter.get("slug"):
        existing = db.select("fighters", {"sherdog_slug": f"eq.{fighter['slug']}", "select": "id"})
        if existing:
            return existing[0]["id"]

    existing_by_name = db.select(
        "fighters", {"name": f"eq.{fighter['name']}", "select": "id,sherdog_slug,photo_url"}
    )
    if existing_by_name:
        row = existing_by_name[0]
        patch = {}
        if fighter.get("slug") and not row.get("sherdog_slug"):
            patch["sherdog_slug"] = fighter["slug"]
        if fighter.get("photo_url") and not row.get("photo_url"):
            patch["photo_url"] = fighter["photo_url"]
        if patch:
            db.update("fighters", patch, {"id": f"eq.{row['id']}"})
        return row["id"]

    created = db.insert(
        "fighters",
        [
            {
                "name": fighter["name"],
                "sherdog_slug": fighter.get("slug"),
                "photo_url": fighter.get("photo_url"),
            }
        ],
    )
    return created[0]["id"]


def import_card(event_id: str) -> None:
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
    if not data["fights"]:
        print("Nenašel jsem žádné zápasy - Sherdog asi změnil HTML strukturu, je třeba upravit selektory v sherdog.py.")
        sys.exit(1)

    created = 0
    for fight in data["fights"]:
        fighter_a_id = upsert_fighter(db, fight["fighter_a"])
        fighter_b_id = upsert_fighter(db, fight["fighter_b"])

        existing = db.select(
            "fights",
            {
                "event_id": f"eq.{event_id}",
                "fighter_a_id": f"eq.{fighter_a_id}",
                "fighter_b_id": f"eq.{fighter_b_id}",
                "select": "id",
            },
        )
        if existing:
            print(f"Zápas {fight['fighter_a']['name']} vs {fight['fighter_b']['name']} už existuje, přeskakuji.")
            continue

        db.insert(
            "fights",
            [
                {
                    "event_id": event_id,
                    "fighter_a_id": fighter_a_id,
                    "fighter_b_id": fighter_b_id,
                    "weight_class": fight["weight_class"],
                    "is_title_fight": fight["is_title_fight"],
                    "is_main_event": fight["is_main_event"],
                    "rounds": 5 if fight["is_title_fight"] else 3,
                    "card_order": fight["card_order"],
                    "status": "scheduled",
                }
            ],
        )
        created += 1
        print(f"Vytvořen zápas: {fight['fighter_a']['name']} vs {fight['fighter_b']['name']}")

    print(f"Hotovo, vytvořeno {created} nových zápasů.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--event-id", required=True)
    args = parser.parse_args()
    import_card(args.event_id)
