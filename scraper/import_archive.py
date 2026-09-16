"""Imports OKTAGON's own back catalogue - galas the group never tipped -
as read-only archive events.

Everything lands in `events`/`fights` so the app's fight card, posters and
fighter photos work unchanged, but every archive row carries
`is_archive = true` and must stay out of anything that counts: leaderboards,
season stats, notifications. Scoring is safe on its own (it is derived from
predictions, and nobody can tip a completed gala) - the danger is the push
loops, so an archive event is also created with every notification marker
already stamped. Even if some future query forgets the flag, there is
nothing left for it to send.

Usage:
    python import_archive.py --from 1 --to 20
    python import_archive.py --all
"""

import argparse
from datetime import datetime, timezone

from import_card import resolve_fighter
from import_fight_stats import import_fight_stats
from oktagon import fetch_all_tournaments, fetch_fightcard
from run_logger import log_run
from supabase_client import SupabaseClient

# Set on every archive event so no notification path can ever pick it up,
# whatever its filters say.
NOTIFICATION_MARKERS = (
    "hype_notified_at",
    "card_notified_at",
    "reminder_sent_at",
    "lock_notified_at",
    "followup_notified_at",
    "fotn_reminder_sent_at",
    "payout_all_paid_notified_at",
    "card_checked_at",
    "results_rechecked_at",
)


def _event_row(tournament: dict, now: str) -> dict:
    row = {
        "number": tournament["number"],
        "name": tournament["name"],
        "subtitle": tournament.get("subtitle"),
        "event_date": tournament["event_date"],
        "location": tournament.get("location"),
        "image_url": tournament.get("image_url"),
        "oktagon_event_id": tournament["oktagon_event_id"],
        "is_archive": True,
        "status": "completed",
        # Nothing about an archive gala is ours: no tipping deadline to
        # manage, no entry fee to collect, no watch party.
        "lock_at": tournament["event_date"],
        "auto_lock": False,
        "payouts_enabled": False,
        "subtitle_locked": True,
    }
    for marker in NOTIFICATION_MARKERS:
        row[marker] = now
    return row


def _upsert_event(db: SupabaseClient, tournament: dict, now: str) -> str | None:
    """Returns our event id, or None if this gala is one of ours and must
    not be touched."""
    existing = db.select(
        "events",
        {
            "oktagon_event_id": f"eq.{tournament['oktagon_event_id']}",
            "select": "id,is_archive,number",
        },
    )
    if not existing:
        existing = db.select(
            "events", {"number": f"eq.{tournament['number']}", "select": "id,is_archive,number"}
        )

    if existing:
        event = existing[0]
        if not event["is_archive"]:
            print(f"OKTAGON {tournament['number']}: tenhle galavečer je náš, nesahám na něj.")
            return None
        db.update("events", _event_row(tournament, now), {"id": f"eq.{event['id']}"})
        return event["id"]

    return db.insert("events", [_event_row(tournament, now)])[0]["id"]


def _import_card(db: SupabaseClient, event_id: str, oktagon_event_id: int) -> int:
    """The whole card at once, results included - an archive gala is over,
    so there is no reason to write it as scheduled and grade it afterwards."""
    fights_data = fetch_fightcard(oktagon_event_id)

    existing = db.select(
        "fights",
        {"event_id": f"eq.{event_id}", "select": "id,oktagon_fight_id"},
    )
    by_oktagon_id = {f["oktagon_fight_id"]: f["id"] for f in existing}

    written = 0
    for fight in fights_data:
        fighter_a_id = resolve_fighter(db, fight["fighter_a"], None)
        fighter_b_id = resolve_fighter(db, fight["fighter_b"], None)

        winner_id = None
        if fight["winner_side"] == "a":
            winner_id = fighter_a_id
        elif fight["winner_side"] == "b":
            winner_id = fighter_b_id

        row = {
            "event_id": event_id,
            "oktagon_fight_id": fight["oktagon_fight_id"],
            "oktagon_esports_id": fight["oktagon_esports_id"],
            "fighter_a_id": fighter_a_id,
            "fighter_b_id": fighter_b_id,
            "weight_class": fight["weight_class"],
            "is_title_fight": fight["is_title_fight"],
            "is_main_event": fight["is_main_event"],
            "card_order": fight["card_order"],
            "card_segment": fight["card_segment"],
            # The API cannot say how long a fight was scheduled for, so the
            # usual guess - five for a belt, three otherwise - applies. On an
            # archive card we know one thing more: a fight that ended in the
            # fourth round was obviously not a three-rounder.
            "rounds": max(5 if fight["is_title_fight"] else 3, fight["result_round"] or 0),
            "status": fight["status"],
            "winner_fighter_id": winner_id,
            "method": fight["method"],
            "result_round": fight["result_round"],
            "result_time": fight["result_time"],
        }

        fight_id = by_oktagon_id.get(fight["oktagon_fight_id"])
        if fight_id:
            db.update("fights", row, {"id": f"eq.{fight_id}"})
        else:
            db.insert("fights", [row])
        written += 1

    return written


def import_archive(number_from: int | None, number_to: int | None) -> None:
    db = SupabaseClient()
    now = datetime.now(timezone.utc).isoformat()

    tournaments = [t for t in fetch_all_tournaments() if t.get("event_date")]
    past = [t for t in tournaments if t["event_date"] < now]
    if number_from is not None:
        past = [t for t in past if number_from <= t["number"] <= (number_to or number_from)]
    past.sort(key=lambda t: t["number"])

    if not past:
        print("Žádné galavečery v zadaném rozsahu.")
        return

    print(f"Zpracovávám {len(past)} galavečerů (OKTAGON {past[0]['number']}–{past[-1]['number']}).")

    events = 0
    fights = 0
    for tournament in past:
        label = f"OKTAGON {tournament['number']}"
        event_id = _upsert_event(db, tournament, now)
        if not event_id:
            continue

        try:
            written = _import_card(db, event_id, tournament["oktagon_event_id"])
        except Exception as exc:
            print(f"{label}: kartu se nepodařilo naimportovat ({exc}), pokračuji.")
            continue

        events += 1
        fights += written
        print(f"{label}: {written} zápasů.")

        # Best effort, exactly as everywhere else this data is touched.
        try:
            import_fight_stats(event_id)
        except Exception as exc:
            print(f"{label}: statistiky se nepodařilo doplnit ({exc}).")

    print(f"Hotovo: {events} galavečerů, {fights} zápasů.")
    print("Historii bojovníků dopln samostatně: import_fighter_history.py --all")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--all", action="store_true", help="všechny odehrané galavečery")
    group.add_argument("--from", dest="number_from", type=int, help="od čísla OKTAGONu")
    parser.add_argument("--to", dest="number_to", type=int, help="do čísla OKTAGONu včetně")
    args = parser.parse_args()

    with log_run("archive_import"):
        import_archive(None if args.all else args.number_from, args.number_to)
