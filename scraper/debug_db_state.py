"""Throwaway debug script - dumps the current fighters/fights rows in
Supabase for one event, so we can check whether duplicate fighter rows
exist (e.g. legacy seed rows never linked up with the OKTAGON-sourced
ones) and whether height_cm/birth_date are actually populated on the
rows the fights table points at.

Usage:
    python debug_db_state.py --number 90
"""

import argparse

from supabase_client import SupabaseClient


def main(number: int) -> None:
    db = SupabaseClient()

    events = db.select("events", {"number": f"eq.{number}", "select": "id,number,name"})
    if not events:
        print(f"OKTAGON {number} nenalezen v DB.")
        return
    event_id = events[0]["id"]
    print(f"event_id={event_id}")

    fights = db.select(
        "fights",
        {
            "event_id": f"eq.{event_id}",
            "select": "id,oktagon_fight_id,fighter_a_id,fighter_b_id,card_order,status",
            "order": "card_order.desc",
        },
    )
    print(f"{len(fights)} zápasů.")

    fighter_ids = sorted({fid for f in fights for fid in (f["fighter_a_id"], f["fighter_b_id"])})
    fighters = db.select(
        "fighters",
        {
            "id": f"in.({','.join(fighter_ids)})",
            "select": "id,name,oktagon_fighter_id,height_cm,birth_date,weight_kg",
        },
    )
    fighters_by_id = {f["id"]: f for f in fighters}

    for f in fights:
        a, b = fighters_by_id[f["fighter_a_id"]], fighters_by_id[f["fighter_b_id"]]
        print(
            f"[{f['card_order']}] id={f['id']} status={f['status']} oktagon_fight_id={f['oktagon_fight_id']!r} | "
            f"{a['name']} (oktagon_id={a['oktagon_fighter_id']!r} height={a['height_cm']!r} "
            f"birth={a['birth_date']!r} weight={a['weight_kg']!r}) vs "
            f"{b['name']} (oktagon_id={b['oktagon_fighter_id']!r} height={b['height_cm']!r} "
            f"birth={b['birth_date']!r} weight={b['weight_kg']!r})"
        )

    all_fighters = db.select(
        "fighters",
        {"select": "id,name,oktagon_fighter_id"},
    )
    name_counts: dict[str, int] = {}
    for f in all_fighters:
        name_counts[f["name"]] = name_counts.get(f["name"], 0) + 1
    dupes = {name: count for name, count in name_counts.items() if count > 1}
    if dupes:
        print("\nMožné duplicitní zápasníky (stejné jméno, víc řádků):")
        for name, count in dupes.items():
            print(f"  {name}: {count}x")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--number", type=int, required=True)
    args = parser.parse_args()
    main(args.number)
