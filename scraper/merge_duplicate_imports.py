"""One-off cleanup: merges fighters/fights that got duplicated the first
time import_card.py ran against the new OKTAGON API. Pre-migration rows
(imported from Sherdog) have no oktagon_fighter_id/oktagon_fight_id, so
the new import couldn't recognize them and created fresh duplicate rows
instead of updating the old ones - leaving every fight shown twice (once
with the old data, once with the new), and orphaning every prediction
already made on the old (legacy) fight/fighter rows.

For each event, matches each legacy fight (oktagon_fight_id is null) to
its OKTAGON-sourced duplicate by normalized fighter-name pairs, then:
- copies the OKTAGON fighter's id + all fresh fields onto the legacy
  fighter row (keeping the legacy row's id),
- copies the OKTAGON fight's id + card/result fields onto the legacy
  fight row (keeping the legacy row's id),
- moves over any predictions that ended up on the duplicate fight, and
- deletes the now-redundant duplicate fighter/fight rows.

Existing predictions reference the legacy fighter_id/fight_id, which are
preserved throughout, so nobody's tips are lost.

Usage:
    python merge_duplicate_imports.py --event-id <uuid>
    python merge_duplicate_imports.py --all
"""

import argparse
import sys
import unicodedata

from supabase_client import SupabaseClient


def normalize_name(name: str) -> str:
    decomposed = unicodedata.normalize("NFKD", name)
    return "".join(c for c in decomposed if not unicodedata.combining(c)).lower().strip()


def merge_event(db: SupabaseClient, event_id: str) -> None:
    fights = db.select(
        "fights",
        {
            "event_id": f"eq.{event_id}",
            "select": (
                "id,oktagon_fight_id,fighter_a_id,fighter_b_id,status,winner_fighter_id,"
                "method,result_round,weight_class,is_title_fight,is_main_event,card_order,rounds"
            ),
        },
    )
    legacy_fights = [f for f in fights if not f.get("oktagon_fight_id")]
    new_fights = [f for f in fights if f.get("oktagon_fight_id")]
    if not legacy_fights or not new_fights:
        return

    fighter_ids = sorted({fid for f in fights for fid in (f["fighter_a_id"], f["fighter_b_id"])})
    fighters = db.select(
        "fighters",
        {
            "id": f"in.({','.join(fighter_ids)})",
            "select": "id,name,nickname,oktagon_fighter_id,photo_url,record,nationality,flag_code,height_cm,birth_date,oktagon_rank",
        },
    )
    fighters_by_id = {f["id"]: f for f in fighters}

    def name_pair(fight: dict) -> frozenset:
        return frozenset(
            [
                normalize_name(fighters_by_id[fight["fighter_a_id"]]["name"]),
                normalize_name(fighters_by_id[fight["fighter_b_id"]]["name"]),
            ]
        )

    new_by_pair = {name_pair(f): f for f in new_fights}

    merged_fights = 0
    merged_fighters = 0
    status_changed = False

    for legacy_fight in legacy_fights:
        new_fight = new_by_pair.get(name_pair(legacy_fight))
        if not new_fight:
            a = fighters_by_id[legacy_fight["fighter_a_id"]]["name"]
            b = fighters_by_id[legacy_fight["fighter_b_id"]]["name"]
            print(f"Nenašel jsem OKTAGON duplikát pro starý zápas {a} vs {b}, přeskakuji.")
            continue

        legacy_a, legacy_b = legacy_fight["fighter_a_id"], legacy_fight["fighter_b_id"]
        new_a, new_b = new_fight["fighter_a_id"], new_fight["fighter_b_id"]
        if normalize_name(fighters_by_id[legacy_a]["name"]) == normalize_name(fighters_by_id[new_a]["name"]):
            fighter_pairs = [(legacy_a, new_a), (legacy_b, new_b)]
        else:
            fighter_pairs = [(legacy_a, new_b), (legacy_b, new_a)]

        winner_fighter_id = None
        if new_fight["winner_fighter_id"] == new_a:
            winner_fighter_id = legacy_a
        elif new_fight["winner_fighter_id"] == new_b:
            winner_fighter_id = legacy_b

        # Carry over any tips a user already made on the duplicate fight
        # (e.g. submitted in the window between the duplicate import and
        # this cleanup) onto the legacy fight, remapping the fighter id
        # if needed. Skip ones that would conflict with a tip the same
        # user already has on the legacy fight.
        dupe_predictions = db.select(
            "predictions",
            {
                "fight_id": f"eq.{new_fight['id']}",
                "select": "user_id,predicted_winner_id,predicted_method,predicted_round",
            },
        )
        for pred in dupe_predictions:
            remapped_winner = legacy_a if pred["predicted_winner_id"] == new_a else (
                legacy_b if pred["predicted_winner_id"] == new_b else pred["predicted_winner_id"]
            )
            already_has = db.select(
                "predictions",
                {
                    "fight_id": f"eq.{legacy_fight['id']}",
                    "user_id": f"eq.{pred['user_id']}",
                    "select": "id",
                },
            )
            if already_has:
                print(f"Tip uživatele {pred['user_id']} na duplicitním zápase přeskočen, na starém už tip má.")
                continue
            db.insert(
                "predictions",
                [
                    {
                        "user_id": pred["user_id"],
                        "fight_id": legacy_fight["id"],
                        "predicted_winner_id": remapped_winner,
                        "predicted_method": pred["predicted_method"],
                        "predicted_round": pred["predicted_round"],
                    }
                ],
            )
        db.delete("predictions", {"fight_id": f"eq.{new_fight['id']}"})

        if new_fight["status"] != legacy_fight["status"]:
            status_changed = True

        db.update(
            "fights",
            {
                "oktagon_fight_id": new_fight["oktagon_fight_id"],
                "weight_class": new_fight["weight_class"],
                "is_title_fight": new_fight["is_title_fight"],
                "is_main_event": new_fight["is_main_event"],
                "card_order": new_fight["card_order"],
                "rounds": new_fight["rounds"],
                "status": new_fight["status"],
                "winner_fighter_id": winner_fighter_id,
                "method": new_fight["method"],
                "result_round": new_fight["result_round"],
            },
            {"id": f"eq.{legacy_fight['id']}"},
        )
        db.delete("fights", {"id": f"eq.{new_fight['id']}"})
        merged_fights += 1

        # Only now is the duplicate fighter row unreferenced by any fight,
        # so it's safe to delete it and free up its oktagon_fighter_id
        # (unique) for the update onto the legacy row right after.
        for legacy_fid, new_fid in fighter_pairs:
            if legacy_fid == new_fid:
                continue
            new_fighter = fighters_by_id[new_fid]
            db.delete("fighters", {"id": f"eq.{new_fid}"})
            db.update(
                "fighters",
                {
                    "oktagon_fighter_id": new_fighter["oktagon_fighter_id"],
                    "name": new_fighter["name"],
                    "nickname": new_fighter["nickname"],
                    "photo_url": new_fighter["photo_url"],
                    "record": new_fighter["record"],
                    "nationality": new_fighter["nationality"],
                    "flag_code": new_fighter["flag_code"],
                    "height_cm": new_fighter["height_cm"],
                    "birth_date": new_fighter["birth_date"],
                    "oktagon_rank": new_fighter["oktagon_rank"],
                },
                {"id": f"eq.{legacy_fid}"},
            )
            merged_fighters += 1

    if status_changed:
        db.rpc("recalculate_event_points", {"p_event_id": event_id})

    print(f"Event {event_id}: sloučeno {merged_fights} zápasů, {merged_fighters} zápasníků.")


def main(event_id: str | None, all_events: bool) -> None:
    db = SupabaseClient()

    if all_events:
        events = db.select("events", {"select": "id"})
        event_ids = [e["id"] for e in events]
    else:
        if not event_id:
            print("Zadej --event-id nebo --all.")
            sys.exit(1)
        event_ids = [event_id]

    for eid in event_ids:
        merge_event(db, eid)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--event-id")
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()
    main(args.event_id, args.all)
