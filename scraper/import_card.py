"""Import the fight card (fighters + fights) for an event from Sherdog,
then fill in each fighter's Fight Matrix rank/score.

Usage:
    python import_card.py --event-id <uuid>

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
The event row must already exist with sherdog_event_url set.
"""

import argparse
import sys

from import_fightmatrix import import_fightmatrix
from run_logger import log_run
from sherdog import fetch_fighter_nationality, parse_event
from supabase_client import SupabaseClient


def _fetch_nationality(profile_url: str | None) -> dict:
    if not profile_url:
        return {}
    try:
        return fetch_fighter_nationality(profile_url)
    except Exception as exc:
        print(f"Nepodařilo se zjistit národnost z {profile_url}: {exc}")
        return {}


def upsert_fighter(db: SupabaseClient, fighter: dict) -> str:
    if fighter.get("slug"):
        existing = db.select(
            "fighters",
            {"sherdog_slug": f"eq.{fighter['slug']}", "select": "id,photo_url,nationality"},
        )
        if existing:
            row = existing[0]
            patch = {}
            if fighter.get("photo_url") and not row.get("photo_url"):
                patch["photo_url"] = fighter["photo_url"]
            if not row.get("nationality"):
                patch.update(_fetch_nationality(fighter.get("profile_url")))
            if patch:
                db.update("fighters", patch, {"id": f"eq.{row['id']}"})
            return row["id"]

    existing_by_name = db.select(
        "fighters",
        {"name": f"eq.{fighter['name']}", "select": "id,sherdog_slug,photo_url,nationality"},
    )
    if existing_by_name:
        row = existing_by_name[0]
        patch = {}
        if fighter.get("slug") and not row.get("sherdog_slug"):
            patch["sherdog_slug"] = fighter["slug"]
        if fighter.get("photo_url") and not row.get("photo_url"):
            patch["photo_url"] = fighter["photo_url"]
        if not row.get("nationality"):
            patch.update(_fetch_nationality(fighter.get("profile_url")))
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
                **_fetch_nationality(fighter.get("profile_url")),
            }
        ],
    )
    return created[0]["id"]


def cancel_stale_fight(
    db: SupabaseClient,
    event_id: str,
    fighter_a_id: str,
    fighter_b_id: str,
    fighter_a_name: str,
    fighter_b_name: str,
) -> int:
    """If either fighter already has a different scheduled fight in this
    event, an opponent pulled out and Sherdog paired them with someone else
    - the old matchup no longer happens. Mark it cancelled instead of
    leaving a stale duplicate on the card; existing predictions on it stay
    (voided, never graded) so tippers can see why it disappeared from
    scoring rather than them silently vanishing. Returns how many fights
    were cancelled, so callers can tell whether the card actually changed."""
    stale = db.select(
        "fights",
        {
            "event_id": f"eq.{event_id}",
            "status": "eq.scheduled",
            "or": (
                f"(fighter_a_id.eq.{fighter_a_id},fighter_b_id.eq.{fighter_a_id},"
                f"fighter_a_id.eq.{fighter_b_id},fighter_b_id.eq.{fighter_b_id})"
            ),
            "select": "id,fighter_a_id,fighter_b_id",
        },
    )
    cancelled = 0
    for row in stale:
        if {row["fighter_a_id"], row["fighter_b_id"]} == {fighter_a_id, fighter_b_id}:
            continue
        db.update("fights", {"status": "cancelled"}, {"id": f"eq.{row['id']}"})
        affected = db.select("predictions", {"fight_id": f"eq.{row['id']}", "select": "id"})
        print(
            f"Soupeř se změnil, starý zápas (id {row['id']}) zrušen - nahrazen "
            f"zápasem {fighter_a_name} vs {fighter_b_name}. Zasaženo tipů: {len(affected)}."
        )
        cancelled += 1
    return cancelled


def import_card(event_id: str) -> tuple[int, int]:
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
    cancelled = 0
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

        cancelled += cancel_stale_fight(
            db, event_id, fighter_a_id, fighter_b_id, fight["fighter_a"]["name"], fight["fighter_b"]["name"]
        )

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

    print("Doplňuji Fight Matrix rank/skóre...")
    try:
        import_fightmatrix(event_id)
    except SystemExit:
        print("Fight Matrix import se nezdařil, karta ze Sherdogu je ale naimportovaná v pořádku.")

    return created, cancelled


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--event-id", required=True)
    args = parser.parse_args()
    with log_run("card", args.event_id):
        import_card(args.event_id)
