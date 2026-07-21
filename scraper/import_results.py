"""Import results for an already-carded event from OKTAGON's API and
recalculate points.

Usage:
    python import_results.py --event-id <uuid>

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
"""

import argparse
import sys

from oktagon import fetch_fightcard, resolve_event_id
from push import send_to_user
from run_logger import log_run
from supabase_client import SupabaseClient

METHOD_PHRASES = {
    "KO/TKO": "KO/TKO",
    "SUBMISSION": "submisí",
}


def _result_description(method: str | None, result_round: int | None, result_time: str | None) -> str:
    if method is None or method == "DECISION":
        return "na body"
    phrase = METHOD_PHRASES.get(method, method)
    desc = f"{phrase} ve {result_round}. kole" if result_round else phrase
    if result_time:
        desc += f" ({result_time})"
    return desc


def _notify_fight_result(
    db: SupabaseClient,
    event_id: str,
    db_fight: dict,
    fighter_a_name: str,
    fighter_b_name: str,
    winner_name: str | None,
    result_desc: str,
) -> None:
    """Sends each tipper on this fight a personal push with the result
    and how their own tip scored, right after this one fight is graded -
    rather than waiting for the whole card to finish."""
    predictions = db.select(
        "predictions",
        {"fight_id": f"eq.{db_fight['id']}", "select": "user_id,predicted_winner_id,points"},
    )
    opted_out = {
        p["id"] for p in db.select("profiles", {"notify_fight_results": "eq.false", "select": "id"})
    }
    predictions = [p for p in predictions if p["user_id"] not in opted_out]
    bold_user_ids = {
        b["user_id"]
        for b in db.select(
            "bold_picks", {"fight_id": f"eq.{db_fight['id']}", "select": "user_id"}
        )
    }
    title = f"{fighter_a_name} vs {fighter_b_name}"
    url = f"/events/{event_id}"
    for pred in predictions:
        if winner_name is None:
            body = "Zápas skončil bez výsledku (remíza/no contest), tvůj tip se nezapočítává."
        else:
            predicted_name = (
                fighter_a_name if pred["predicted_winner_id"] == db_fight["fighter_a_id"] else fighter_b_name
            )
            points = pred.get("points") or 0
            bold_suffix = ""
            if pred["user_id"] in bold_user_ids and points > 0:
                bold_suffix = f" (jistotka ×2 = {points * 2} b.)"
            body = f"Vyhrál {winner_name} ({result_desc}). Tvůj tip: {predicted_name} → {points} b.{bold_suffix}"
        send_to_user(db, pred["user_id"], title, body, url)


STARTOVNE_CZK = 50


def _announce_payout_pool(db: SupabaseClient, event_id: str, event: dict) -> None:
    """Posts a system message to the event's kecárna naming the
    startovné pool winner - winner-takes-all at STARTOVNE_CZK per
    tipping participant, settled peer-to-peer (bank transfer) outside
    the app. Same ranking as event_leaderboard's own tiebreak chain."""
    if not event.get("payouts_enabled", True):
        return

    label = f"OKTAGON {event['number']}" if event.get("number") else event["name"]
    rows = db.select(
        "event_leaderboard",
        {
            "event_id": f"eq.{event_id}",
            "select": "user_id,nickname",
            "order": "points.desc,fights_correct_winner.desc,perfect_card.desc,earliest_prediction_at.asc",
        },
    )
    if len(rows) < 2:
        return

    winner = rows[0]
    pot = (len(rows) - 1) * STARTOVNE_CZK
    winner_name = winner.get("nickname") or "Bez přezdívky"
    db.insert(
        "event_comments",
        [
            {
                "event_id": event_id,
                "user_id": None,
                "is_system": True,
                "body": (
                    f"💰 {label}: startovné vyhrál/a {winner_name} a bere {pot} Kč "
                    f"({len(rows) - 1}× {STARTOVNE_CZK} Kč). Podrobnosti a QR platba na stránce galavečera."
                ),
            }
        ],
    )
    print(f"Startovné: vyhrál/a {winner_name}, pool {pot} Kč. Oznámeno v kecárně.")

    # The one moment this actually blocks someone from getting paid -
    # nudge the winner directly instead of relying on them noticing the
    # banner/kecárna message.
    winner_profile = db.select("profiles", {"id": f"eq.{winner['user_id']}", "select": "bank_account"})
    if winner_profile and not winner_profile[0].get("bank_account"):
        send_to_user(
            db,
            winner["user_id"],
            f"{label}: vyhrál/a jsi startovné!",
            f"Bereš {pot} Kč. Nastav si v profilu číslo účtu, ať ti kamarádi mají kam poslat výhru.",
            "/profile",
        )


def import_results(event_id: str) -> None:
    db = SupabaseClient()

    events = db.select(
        "events", {"id": f"eq.{event_id}", "select": "id,number,name,oktagon_event_id,actual_fotn_fight_id,payouts_enabled"}
    )
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

        fighter_a_name, fighter_b_name = fight["fighter_a"]["name"], fight["fighter_b"]["name"]

        if fight["status"] == "no_contest":
            db.update("fights", {"status": "no_contest"}, {"id": f"eq.{db_fight['id']}"})
            db.rpc("recalculate_fight_points", {"p_fight_id": db_fight["id"]})
            updated += 1
            print(f"Zápas {fighter_a_name} vs {fighter_b_name} -> remíza / no contest.")
            _notify_fight_result(db, event_id, db_fight, fighter_a_name, fighter_b_name, None, "")
            continue

        winner_id = db_fight["fighter_a_id"] if fight["winner_side"] == "a" else db_fight["fighter_b_id"]
        winner_name = fighter_a_name if fight["winner_side"] == "a" else fighter_b_name
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
        db.rpc("recalculate_fight_points", {"p_fight_id": db_fight["id"]})
        updated += 1
        print(f"Uložen výsledek: {fighter_a_name} vs {fighter_b_name} -> {fight['method']}")

        result_desc = _result_description(fight["method"], fight["result_round"], fight["result_time"])
        _notify_fight_result(db, event_id, db_fight, fighter_a_name, fighter_b_name, winner_name, result_desc)

    if updated:
        print(f"Přepočítány body pro {updated} zápasů.")
    else:
        print("Žádné nové výsledky k uložení (OKTAGON je možná ještě nemá zveřejněné).")

    remaining = db.select(
        "fights",
        {"event_id": f"eq.{event_id}", "status": "eq.scheduled", "select": "id"},
    )
    if remaining:
        return

    if not event["actual_fotn_fight_id"]:
        print("Všechny zápasy odehrané, čekám na zadání Fight of the Night, než galavečer uzavřu.")
        return

    db.update("events", {"status": "completed"}, {"id": f"eq.{event_id}"})
    print("Všechny zápasy odehrané a FOTN zadané, galavečer označen jako vyhodnocený.")
    _announce_payout_pool(db, event_id, event)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--event-id", required=True)
    args = parser.parse_args()
    with log_run("results", args.event_id):
        import_results(args.event_id)
