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

    events = db.select(
        "events",
        {
            "number": f"eq.{number}",
            "select": "id,number,name,status,lock_at,actual_fotn_fight_id,results_rechecked_at",
        },
    )
    if not events:
        print(f"OKTAGON {number} nenalezen v DB.")
        return
    event = events[0]
    event_id = event["id"]
    print(f"event_id={event_id}")
    # Both the fight-stats and the fighter-history refresh hang off the event
    # reaching `completed`, which itself waits on the admin entering the Fight
    # of the Night - so these four fields explain most "why is it not there".
    print(
        f"status={event['status']!r} lock_at={event['lock_at']!r} "
        f"fotn={event['actual_fotn_fight_id']!r} "
        f"rechecked={event.get('results_rechecked_at')!r}"
    )

    fights = db.select(
        "fights",
        {
            "event_id": f"eq.{event_id}",
            "select": (
                "id,oktagon_fight_id,oktagon_esports_id,fighter_a_id,fighter_b_id,"
                "card_order,status"
            ),
            "order": "card_order.desc",
        },
    )
    print(f"{len(fights)} zápasů.")

    # The link into the external tracking system, and whether stats actually
    # landed. A fight whose card was imported before that column existed has
    # no link at all and can never get stats.
    stats_rows = db.select(
        "fight_stats",
        {
            "fight_id": f"in.({','.join(f['id'] for f in fights)})",
            "select": "fight_id,esports_match_id,fighter_a_hits,fighter_b_hits",
        },
    ) if fights else []
    stats_by_fight = {row["fight_id"]: row for row in stats_rows}
    linked = sum(1 for f in fights if f.get("oktagon_esports_id"))
    print(f"napojení na statistiky: {linked}/{len(fights)}, uložené statistiky: {len(stats_rows)}")

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
            f"[{f['card_order']}] id={f['id']} status={f['status']} "
            f"oktagon_fight_id={f['oktagon_fight_id']!r} "
            f"esports={f.get('oktagon_esports_id')!r} "
            f"stats={'ano' if f['id'] in stats_by_fight else 'ne'} | "
            f"{a['name']} (oktagon_id={a['oktagon_fighter_id']!r} height={a['height_cm']!r} "
            f"birth={a['birth_date']!r} weight={a['weight_kg']!r}) vs "
            f"{b['name']} (oktagon_id={b['oktagon_fighter_id']!r} height={b['height_cm']!r} "
            f"birth={b['birth_date']!r} weight={b['weight_kg']!r})"
        )

    # A fight that has a link but no stats row means the sides could not be
    # matched - print what the external system thinks the names are, because
    # that is the only way to see why ours did not line up.
    unmatched = [
        f for f in fights if f.get("oktagon_esports_id") and f["id"] not in stats_by_fight
    ]
    if unmatched:
        from oktagon import fetch_match_stats

        print("\nZápasy s napojením, ale bez statistik:")
        for f in unmatched:
            payload = fetch_match_stats(f["oktagon_esports_id"])
            if not payload:
                print(f"  esports={f['oktagon_esports_id']}: externí systém nic nevrátil.")
                continue
            for key in ("fighter1", "fighter2"):
                entry = payload.get(key) or {}
                print(
                    f"  esports={f['oktagon_esports_id']} {key}: "
                    f"{entry.get('firstname')!r} {entry.get('lastname')!r} "
                    f"externalId={entry.get('externalId')!r}"
                )
            a, b = fighters_by_id[f["fighter_a_id"]], fighters_by_id[f["fighter_b_id"]]
            print(f"    u nás: {a['name']!r} / {b['name']!r}")

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
