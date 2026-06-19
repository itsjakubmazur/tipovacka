"""Throwaway debug script - dumps the raw fighter JSON for one fight so we
can check the actual key names OKTAGON's API uses for height/birth date
(no DB access, no push sent).

Usage:
    python debug_fighter_fields.py --number 89
"""

import argparse
import json

from oktagon import fetch_json, find_event_id


def main(number: int) -> None:
    oktagon_event_id = find_event_id(number)
    if not oktagon_event_id:
        print(f"OKTAGON {number} nenalezen v API.")
        return

    cards = fetch_json(f"/events/{oktagon_event_id}/fightcard")
    raw_fights = [fight for card in cards for fight in card.get("fights", [])]
    if not raw_fights:
        print("Žádné zápasy.")
        return

    fighter = raw_fights[0]["fighter1"]
    print(json.dumps(fighter, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--number", type=int, required=True)
    args = parser.parse_args()
    main(args.number)
