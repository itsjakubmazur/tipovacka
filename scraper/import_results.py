"""Import results for an already-carded event from OKTAGON's API and
recalculate points.

Usage:
    python import_results.py --event-id <uuid>

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
"""

import argparse
import sys

from oktagon import fetch_fightcard, resolve_event_id
from push import log_push, send_to_user
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


def _notify_fight_result_safely(*args, **kwargs) -> None:
    """Push notifications are a nicety; scoring is the point.

    _notify_fight_result reaches out to the standings and the push service,
    and it runs inside the loop that grades the card - so anything it raises
    used to abandon the import and leave the remaining fights ungraded. Any
    failure here is logged and swallowed instead.
    """
    try:
        _notify_fight_result(*args, **kwargs)
    except Exception as exc:
        print(f"Upozornění na výsledek se nepodařilo odeslat: {exc}")


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
    # Where everyone stands *after* this fight, so the push can say what the
    # result actually did to you rather than just handing over a number.
    standings = db.select(
        "event_leaderboard",
        {
            "event_id": f"eq.{event_id}",
            "select": "user_id,points",
            "order": "points.desc,fights_correct_winner.desc,perfect_card.desc,earliest_prediction_at.asc",
        },
    )
    rank_by_user = {row["user_id"]: i + 1 for i, row in enumerate(standings)}
    total_players = len(standings)

    def _standing_suffix(user_id: str) -> str:
        rank = rank_by_user.get(user_id)
        if not rank or total_players < 2:
            return ""
        if rank == 1:
            return f" Vedeš, {rank}. z {total_players}!"
        behind = standings[rank - 2]["points"] - standings[rank - 1]["points"]
        return f" Jsi {rank}. z {total_players}, na {rank - 1}. místo ztrácíš {behind} b."

    title = f"🥊 {fighter_a_name} vs {fighter_b_name}"
    url = f"/events/{event_id}"
    notified = 0
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
            body = (
                f"Vyhrál {winner_name} ({result_desc}). Tvůj tip: {predicted_name} → "
                f"{points} b.{bold_suffix}{_standing_suffix(pred['user_id'])}"
            )
        send_to_user(db, pred["user_id"], title, body, url)
        notified += 1

    log_push(
        db,
        kind="fight_result",
        title=title,
        body=f"Výsledek zápasu {fighter_a_name} vs {fighter_b_name} a body každého tipéra.",
        recipients=notified,
        event_id=event_id,
    )


def _notify_result_correction_safely(*args, **kwargs) -> None:
    try:
        _notify_result_correction(*args, **kwargs)
    except Exception as exc:
        print(f"Upozornění na opravu výsledku se nepodařilo odeslat: {exc}")


def _notify_result_correction(
    db: SupabaseClient,
    event_id: str,
    db_fight: dict,
    fighter_a_name: str,
    fighter_b_name: str,
    winner_name: str | None,
    result_desc: str,
) -> None:
    """Tells everyone who tipped this fight that the result changed.

    Without this the first, wrong push is the only thing anyone remembers -
    their points quietly move overnight and nobody knows why."""
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
        for b in db.select("bold_picks", {"fight_id": f"eq.{db_fight['id']}", "select": "user_id"})
    }

    title = f"✏️ Oprava: {fighter_a_name} vs {fighter_b_name}"
    url = f"/events/{event_id}"
    notified = 0
    for pred in predictions:
        if winner_name is None:
            body = "Zápas je nově veden bez výsledku (remíza/no contest), tvůj tip se nezapočítává."
        else:
            predicted_name = (
                fighter_a_name if pred["predicted_winner_id"] == db_fight["fighter_a_id"] else fighter_b_name
            )
            points = pred.get("points") or 0
            bold_suffix = ""
            if pred["user_id"] in bold_user_ids and points > 0:
                bold_suffix = f" (jistotka ×2 = {points * 2} b.)"
            body = (
                f"OKTAGON výsledek upravil: vyhrál {winner_name} ({result_desc}). "
                f"Tvůj tip: {predicted_name} → nově {points} b.{bold_suffix}"
            )
        send_to_user(db, pred["user_id"], title, body, url)
        notified += 1

    log_push(
        db,
        kind="fight_result_correction",
        title=title,
        body=f"Opravený výsledek zápasu {fighter_a_name} vs {fighter_b_name} a přepočítané body.",
        recipients=notified,
        event_id=event_id,
    )


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
            f"💰 {label}: vyhrál/a jsi startovné!",
            f"Bereš {pot} Kč. Nastav si v profilu číslo účtu, ať ti kamarádi mají kam poslat výhru.",
            "/profile",
        )
        log_push(
            db,
            kind="payout_win",
            title=f"💰 {label}: vyhrál/a jsi startovné!",
            body=f"Bereš {pot} Kč, nastav si v profilu číslo účtu.",
            recipients=1,
            event_id=event_id,
        )


def _announce_corrections(
    db: SupabaseClient,
    event_id: str,
    event: dict,
    corrected: list[str],
    leader_before: tuple[str, str] | None,
) -> None:
    """Says out loud in the kecárna that a result moved.

    Points changing under people's feet with no explanation is worse than the
    wrong result was - especially once startovné has been announced, where a
    correction can hand the pot to somebody else."""
    label = f"OKTAGON {event['number']}" if event.get("number") else event["name"]
    fights = ", ".join(corrected)
    body = (
        f"✏️ {label}: OKTAGON opravil výsledek – {fights}. Body jsou přepočítané."
    )

    leader_after = _leader(db, event_id)
    if leader_before and leader_after and leader_before[0] != leader_after[0]:
        body += f" Tím se mění i pořadí: nově vede {leader_after[1]}."
        if event.get("payouts_enabled", True):
            body += " Startovné patří jemu/jí."

    db.insert(
        "event_comments",
        [{"event_id": event_id, "user_id": None, "is_system": True, "body": body}],
    )
    print(body)


def _leader(db: SupabaseClient, event_id: str) -> tuple[str, str] | None:
    rows = db.select(
        "event_leaderboard",
        {
            "event_id": f"eq.{event_id}",
            "select": "user_id,nickname",
            "order": "points.desc,fights_correct_winner.desc,perfect_card.desc,earliest_prediction_at.asc",
        },
    )
    if len(rows) < 2:
        return None
    return rows[0]["user_id"], rows[0].get("nickname") or "Bez přezdívky"


def import_results(event_id: str) -> None:
    db = SupabaseClient()

    events = db.select(
        "events",
        {
            "id": f"eq.{event_id}",
            "select": "id,number,name,status,oktagon_event_id,actual_fotn_fight_id,payouts_enabled",
        },
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

    was_completed = event.get("status") == "completed"
    leader_before = _leader(db, event_id)

    fights_in_db = db.select(
        "fights",
        {
            "event_id": f"eq.{event_id}",
            "select": (
                "id,oktagon_fight_id,fighter_a_id,fighter_b_id,status,result_locked,"
                "winner_fighter_id,method,result_round,result_time"
            ),
        },
    )
    by_oktagon_id = {f["oktagon_fight_id"]: f for f in fights_in_db if f.get("oktagon_fight_id")}

    updated = 0
    corrected: list[str] = []
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

        fighter_a_name, fighter_b_name = fight["fighter_a"]["name"], fight["fighter_b"]["name"]
        matchup = f"{fighter_a_name} vs {fighter_b_name}"

        # An admin who corrected this result outranks the feed. Without this
        # guard the re-check would undo their fix on the very next tick.
        if db_fight.get("result_locked"):
            continue

        if fight["status"] == "no_contest":
            desired = {
                "status": "no_contest",
                "winner_fighter_id": None,
                "method": None,
                "result_round": None,
                "result_time": None,
            }
            winner_id, winner_name = None, None
        else:
            winner_id = db_fight["fighter_a_id"] if fight["winner_side"] == "a" else db_fight["fighter_b_id"]
            winner_name = fighter_a_name if fight["winner_side"] == "a" else fighter_b_name
            desired = {
                "status": "completed",
                "winner_fighter_id": winner_id,
                "method": fight["method"],
                "result_round": fight["result_round"],
                "result_time": fight["result_time"],
            }

        # A fight is graded once and then only ever revisited if the feed
        # disagrees with what we stored - which is the whole point of the
        # re-check, and also why an unchanged result costs nothing.
        first_time = db_fight["status"] == "scheduled"
        if not first_time and all(db_fight.get(k) == v for k, v in desired.items()):
            continue

        db.update("fights", desired, {"id": f"eq.{db_fight['id']}"})
        db.rpc("recalculate_fight_points", {"p_fight_id": db_fight["id"]})
        updated += 1

        result_desc = _result_description(
            desired["method"], desired["result_round"], desired["result_time"]
        )
        if first_time:
            if winner_name is None:
                print(f"Zápas {matchup} -> remíza / no contest.")
            else:
                print(f"Uložen výsledek: {matchup} -> {desired['method']}")
            _notify_fight_result_safely(
                db, event_id, db_fight, fighter_a_name, fighter_b_name, winner_name, result_desc
            )
        else:
            corrected.append(matchup)
            print(f"OPRAVA výsledku: {matchup} -> {winner_name or 'bez výsledku'}")
            _notify_result_correction_safely(
                db, event_id, db_fight, fighter_a_name, fighter_b_name, winner_name, result_desc
            )

    if updated:
        print(f"Přepočítány body pro {updated} zápasů.")
    else:
        print("Žádné nové výsledky k uložení (OKTAGON je možná ještě nemá zveřejněné).")

    if corrected:
        _announce_corrections(db, event_id, event, corrected, leader_before)

    remaining = db.select(
        "fights",
        {"event_id": f"eq.{event_id}", "status": "eq.scheduled", "select": "id"},
    )
    if remaining:
        return

    if was_completed:
        # already closed - a re-check only ever corrects results, it must not
        # announce the payout a second time
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
