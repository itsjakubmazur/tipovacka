"""Throwaway debug script - dumps the raw fighter JSON for one fight so we
can check the actual key names OKTAGON's API uses for height/birth date
(no DB access, no push sent).

Usage:
    python debug_fighter_fields.py --number 89
"""

import argparse
import json

from oktagon import fetch_json, find_event_id


def main(number: int | None) -> None:
    if number is None:
        events = fetch_json("/events/")
        for item in events:
            print(item.get("id"), item.get("slugs"))
        return

    oktagon_event_id = find_event_id(number)
    if not oktagon_event_id:
        print(f"OKTAGON {number} nenalezen v API.")
        return

    cards = fetch_json(f"/events/{oktagon_event_id}/fightcard")
    for i, card in enumerate(cards):
        card_keys = {k: v for k, v in card.items() if k != "fights"}
        print(f"card[{i}] keys/values (excl. fights): {card_keys!r}")
    raw_fights = [fight for card in cards for fight in card.get("fights", [])]
    if not raw_fights:
        print("Žádné zápasy.")
        return

    for fight in raw_fights:
        for key in ("fighter1", "fighter2"):
            f = fight[key]
            name = f"{f.get('firstName')} {f.get('lastName')}"
            print(
                f"{name}: heightCm={f.get('heightCm')!r} "
                f"birth={f.get('yearOfBirth')!r}-{f.get('monthOfBirth')!r}-{f.get('dayOfBirth')!r} "
                f"weightKg={(f.get('weightClass') or {}).get('weightKg')!r}"
            )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--number", type=int, required=False)
    args = parser.parse_args()
    main(args.number)
