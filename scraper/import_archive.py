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
# Whose shows belong in an OKTAGON archive. Deliberately not "everything the
# API returns": the /v1/events/ listing is shared with other promotions.
# FABRIQ is inconsistent - its first two cards are tagged OKTAGON_MMA and the
# third FABRIQ_MMA - so those two come along and the third does not.
ORGANIZATIONS = {"OKTAGON_MMA"}

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


def _label(tournament: dict) -> str:
    return (
        f"OKTAGON {tournament['number']}"
        if tournament.get("number") is not None
        else tournament.get("slug") or tournament["name"]
    )


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
    if not existing and tournament.get("number") is not None:
        existing = db.select(
            "events", {"number": f"eq.{tournament['number']}", "select": "id,is_archive,number"}
        )

    if existing:
        event = existing[0]
        if not event["is_archive"]:
            print(f"{_label(tournament)}: tenhle galavečer je náš, nesahám na něj.")
            return None
        db.update("events", _event_row(tournament, now), {"id": f"eq.{event['id']}"})
        return event["id"]

    return db.insert("events", [_event_row(tournament, now)])[0]["id"]


def _import_card(db: SupabaseClient, event_id: str, fights_data: list[dict]) -> int:
    """The whole card at once, results included - an archive gala is over,
    so there is no reason to write it as scheduled and grade it afterwards."""
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


def import_archive(
    number_from: int | None,
    number_to: int | None,
    unnumbered_only: bool = False,
    list_only: bool = False,
) -> None:
    db = SupabaseClient()
    now = datetime.now(timezone.utc).isoformat()

    tournaments = [t for t in fetch_all_tournaments() if t.get("event_date")]
    # The listing carries other promotions too - PML, THE RING, FNC and one
    # FABRIQ card are all in there. An archive of OKTAGON is OKTAGON's own.
    tournaments = [t for t in tournaments if t.get("organization_id") in ORGANIZATIONS]
    past = [t for t in tournaments if t["event_date"] < now]
    if unnumbered_only:
        past = [t for t in past if t.get("number") is None]
    elif number_from is not None:
        past = [
            t
            for t in past
            if t.get("number") is not None
            and number_from <= t["number"] <= (number_to or number_from)
        ]
    # A show with no number sorts by date; the numbered ones keep their order.
    past.sort(key=lambda t: (t["number"] is None, t["number"] or 0, t["event_date"]))

    if not past:
        print("Žádné galavečery v zadaném rozsahu.")
        return

    print(f"Zpracovávám {len(past)} galavečerů.")

    if list_only:
        for t in past:
            print(
                f"  {t['event_date'][:10]}  {_label(t):<28} org={t.get('organization_id')!r}  "
                f"{t['name']}"
            )
        print(f"Celkem {len(past)} galavečerů (nic se nezapisovalo).")
        return

    events = 0
    fights = 0
    for tournament in past:
        label = _label(tournament)

        # The card comes first: OKTAGON keeps placeholder entries for galas
        # that got moved or called off ("OKTAGON PRIME 4 - SE PŘESOUVÁ"), and
        # an archive event with no fights in it is just noise in the listing.
        try:
            fights_data = fetch_fightcard(tournament["oktagon_event_id"])
        except Exception as exc:
            print(f"{label}: kartu se nepodařilo stáhnout ({exc}), pokračuji.")
            continue
        if not fights_data:
            print(f"{label}: prázdná karta, přeskakuji.")
            continue

        event_id = _upsert_event(db, tournament, now)
        if not event_id:
            continue

        written = _import_card(db, event_id, fights_data)

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
    group.add_argument(
        "--unnumbered", action="store_true", help="jen turnaje bez čísla (Prime, Underground, …)"
    )
    parser.add_argument("--to", dest="number_to", type=int, help="do čísla OKTAGONu včetně")
    parser.add_argument(
        "--list", action="store_true", dest="list_only", help="jen vypsat, nic neimportovat"
    )
    args = parser.parse_args()

    with log_run("archive_import"):
        import_archive(
            None if (args.all or args.unnumbered) else args.number_from,
            args.number_to,
            unnumbered_only=args.unnumbered,
            list_only=args.list_only,
        )
