"""Temporary diagnostic: list all fights + fighter names for an event, to
investigate duplicate fights created by a name mismatch between manually
seeded data and Sherdog-scraped names.

Usage: python inspect_event.py --event-id <uuid>
"""

import argparse

from supabase_client import SupabaseClient


def main(event_id: str) -> None:
    db = SupabaseClient()
    fights = db.select(
        "fights",
        {
            "event_id": f"eq.{event_id}",
            "select": "id,card_order,is_main_event,weight_class,fighter_a:fighter_a_id(id,name,sherdog_slug),fighter_b:fighter_b_id(id,name,sherdog_slug)",
            "order": "card_order",
        },
    )
    print(f"Celkem zápasů: {len(fights)}")
    for f in fights:
        a = f["fighter_a"]
        b = f["fighter_b"]
        print(
            f"#{f['card_order']:>2} main={f['is_main_event']!s:5} "
            f"{a['name']!r} (id={a['id']}, slug={a['sherdog_slug']}) vs "
            f"{b['name']!r} (id={b['id']}, slug={b['sherdog_slug']})  [{f['id']}]"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--event-id", required=True)
    args = parser.parse_args()
    main(args.event_id)
