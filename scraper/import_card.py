"""Import the fight card (fighters + fights) for an event from OKTAGON's
own backend API - fighter bios, photos, records, and rankings all come
from the same source.

Usage:
    python import_card.py --event-id <uuid>

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
The event row must have `number` set so its OKTAGON event id can be
resolved (cached onto oktagon_event_id after the first successful run).
"""

import argparse
import sys

from oktagon import fetch_fightcard, import_image, resolve_event_id
from run_logger import log_run
from supabase_client import SupabaseClient


def upsert_fighter(db: SupabaseClient, fighter: dict) -> str:
    """OKTAGON's own data is authoritative, so every field is overwritten
    on every import/recheck - unlike the old Sherdog code, there's no
    need to cautiously fill in only missing fields."""
    existing = db.select(
        "fighters",
        {"oktagon_fighter_id": f"eq.{fighter['oktagon_fighter_id']}", "select": "id"},
    )
    patch = {
        "name": fighter["name"],
        "nickname": fighter["nickname"],
        "photo_url": fighter["photo_url"],
        "fight_card_photo_url": fighter["fight_card_photo_url"],
        "bio": fighter["bio"],
        "record": fighter["record"],
        "amateur_record": fighter["amateur_record"],
        "nationality": fighter["nationality"],
        "flag_code": fighter["flag_code"],
        "height_cm": fighter["height_cm"],
        "weight_kg": fighter["weight_kg"],
        "birth_date": fighter["birth_date"],
        "oktagon_rank": fighter["oktagon_rank"],
        "oktagon_rank_change": fighter["oktagon_rank_change"],
        "oktagon_slug": fighter["oktagon_slug"],
    }
    if existing:
        db.update("fighters", patch, {"id": f"eq.{existing[0]['id']}"})
        return existing[0]["id"]

    # Not linked to OKTAGON yet - this is most likely a fighter imported
    # before the switch from Sherdog, which has no oktagon_fighter_id.
    # Attach it to that existing row instead of creating a duplicate, so
    # its id (and any predictions pointing at it) stay intact.
    existing_by_name = db.select(
        "fighters",
        {"name": f"ilike.{fighter['name']}", "oktagon_fighter_id": "is.null", "select": "id"},
    )
    if existing_by_name:
        row_id = existing_by_name[0]["id"]
        db.update("fighters", {"oktagon_fighter_id": fighter["oktagon_fighter_id"], **patch}, {"id": f"eq.{row_id}"})
        return row_id

    created = db.insert(
        "fighters", [{"oktagon_fighter_id": fighter["oktagon_fighter_id"], **patch}]
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
    event, an opponent pulled out and OKTAGON paired them with someone
    else - the old matchup no longer happens. Mark it cancelled instead
    of leaving a stale duplicate on the card; existing predictions on it
    stay (voided, never graded) so tippers can see why it disappeared
    from scoring rather than them silently vanishing. Returns how many
    fights were cancelled, so callers can tell whether the card actually
    changed."""
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
    if not fights_data:
        print("Nenašel jsem žádné zápasy - OKTAGON API asi změnilo strukturu, je třeba upravit oktagon.py.")
        sys.exit(1)

    created = 0
    cancelled = 0
    for fight in fights_data:
        fighter_a_id = upsert_fighter(db, fight["fighter_a"])
        fighter_b_id = upsert_fighter(db, fight["fighter_b"])

        existing = db.select(
            "fights",
            {"oktagon_fight_id": f"eq.{fight['oktagon_fight_id']}", "select": "id"},
        )
        if existing:
            continue

        # Not linked to OKTAGON yet - this is most likely a fight imported
        # before the switch from Sherdog. Attach it to that existing row
        # instead of creating a duplicate, so its id (and any predictions
        # pointing at it) stay intact.
        existing_legacy = db.select(
            "fights",
            {
                "event_id": f"eq.{event_id}",
                "oktagon_fight_id": "is.null",
                "fighter_a_id": f"eq.{fighter_a_id}",
                "fighter_b_id": f"eq.{fighter_b_id}",
                "select": "id",
            },
        )
        if existing_legacy:
            db.update(
                "fights",
                {
                    "oktagon_fight_id": fight["oktagon_fight_id"],
                    "weight_class": fight["weight_class"],
                    "is_title_fight": fight["is_title_fight"],
                    "is_main_event": fight["is_main_event"],
                    "rounds": 5 if fight["is_title_fight"] else 3,
                    "card_order": fight["card_order"],
                },
                {"id": f"eq.{existing_legacy[0]['id']}"},
            )
            continue

        cancelled += cancel_stale_fight(
            db, event_id, fighter_a_id, fighter_b_id, fight["fighter_a"]["name"], fight["fighter_b"]["name"]
        )

        db.insert(
            "fights",
            [
                {
                    "event_id": event_id,
                    "oktagon_fight_id": fight["oktagon_fight_id"],
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

    print("Doplňuji titulní obrázek z oktagonmma.com...")
    try:
        import_image(event_id)
    except Exception as exc:
        print(f"Obrázek se nepodařilo doplnit: {exc}")

    return created, cancelled


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--event-id", required=True)
    args = parser.parse_args()
    with log_run("card", args.event_id):
        import_card(args.event_id)
