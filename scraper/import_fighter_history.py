"""Imports every fighter's OKTAGON fight history - who they faced and how
it ended - into `fighter_oktagon_fights`.

Deliberately NOT into `fights`: that table plus `events` drives scoring, the
season standings (season = year of events.event_date) and the gala list, so
backfilling OKTAGON 1 from 2016 there would wreck the leaderboard and flood
the app with galas nobody ever tipped.

One request per fighter (GET /v1/fights?fighterId=...) returns their whole
history, so refreshing a full fight card costs about two dozen calls.
"""

import argparse
import sys
from datetime import datetime, timezone

from oktagon import fetch_fighter_history, normalize_history_fight
from run_logger import log_run
from supabase_client import SupabaseClient


def _fighters_by_oktagon_id(db: SupabaseClient) -> dict[int, str]:
    """Every fighter we know, keyed by OKTAGON's id - used to turn an
    opponent into a real link into `fighters` when we happen to have them."""
    rows = db.select(
        "fighters",
        {"oktagon_fighter_id": "not.is.null", "select": "id,oktagon_fighter_id"},
    )
    return {row["oktagon_fighter_id"]: row["id"] for row in rows}


def _target_fighters(db: SupabaseClient, event_id: str | None) -> list[dict]:
    if event_id is None:
        return db.select(
            "fighters",
            {"oktagon_fighter_id": "not.is.null", "select": "id,name,oktagon_fighter_id"},
        )

    fights = db.select(
        "fights",
        {"event_id": f"eq.{event_id}", "select": "fighter_a_id,fighter_b_id"},
    )
    ids = {f[side] for f in fights for side in ("fighter_a_id", "fighter_b_id") if f[side]}
    if not ids:
        return []
    return db.select(
        "fighters",
        {
            "id": f"in.({','.join(sorted(ids))})",
            "oktagon_fighter_id": "not.is.null",
            "select": "id,name,oktagon_fighter_id",
        },
    )


def import_fighter_history(event_id: str | None = None) -> int:
    """Refreshes the history of one event's fighters, or of everybody when
    no event is given. Returns how many fights were written."""
    db = SupabaseClient()

    fighters = _target_fighters(db, event_id)
    if not fighters:
        print("Žádní bojovníci k doplnění historie.")
        return 0

    known = _fighters_by_oktagon_id(db)
    now = datetime.now(timezone.utc).isoformat()
    written = 0

    for fighter in fighters:
        try:
            history = fetch_fighter_history(fighter["oktagon_fighter_id"])
        except Exception as exc:
            print(f"Historii pro {fighter['name']} se nepodařilo stáhnout: {exc}")
            continue

        rows = []
        for item in history:
            row = normalize_history_fight(item, fighter["oktagon_fighter_id"])
            if not row:
                continue
            rows.append(
                {
                    **row,
                    "fighter_id": fighter["id"],
                    "opponent_fighter_id": known.get(row["opponent_oktagon_fighter_id"]),
                    "updated_at": now,
                }
            )

        if rows:
            db.upsert(
                "fighter_oktagon_fights", rows, on_conflict="fighter_id,oktagon_fight_id"
            )
            written += len(rows)

        # A fight OKTAGON removed (or corrected out of existence) would
        # otherwise sit in the history forever - the fresh pull is the truth.
        fresh_ids = {row["oktagon_fight_id"] for row in rows}
        stored = db.select(
            "fighter_oktagon_fights",
            {"fighter_id": f"eq.{fighter['id']}", "select": "oktagon_fight_id"},
        )
        stale = [r["oktagon_fight_id"] for r in stored if r["oktagon_fight_id"] not in fresh_ids]
        if stale:
            db.delete(
                "fighter_oktagon_fights",
                {
                    "fighter_id": f"eq.{fighter['id']}",
                    "oktagon_fight_id": f"in.({','.join(str(i) for i in stale)})",
                },
            )

        print(f"{fighter['name']}: {len(rows)} zápasů v OKTAGONu.")

    print(f"Hotovo, uloženo {written} záznamů historie.")
    return written


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--event-id", help="jen bojovníci z karty tohoto galavečera")
    group.add_argument("--all", action="store_true", help="všichni bojovníci v DB")
    args = parser.parse_args()

    if args.all and args.event_id:
        sys.exit("Použij buď --event-id, nebo --all.")

    with log_run("fighter_history", args.event_id):
        import_fighter_history(args.event_id)
