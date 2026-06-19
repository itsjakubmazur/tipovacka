"""Dry-run sanity check for the per-fight result/notification logic
against a real OKTAGON event - no database access, no push sent. Prints
what each fight's notification text would look like, using the actual
OKTAGON API response, so the formatting/parsing logic can be verified
against real data before relying on it live.

Usage:
    python preview_results.py --number 89
"""

import argparse

from import_results import _result_description
from oktagon import fetch_fightcard, find_event_id


def main(number: int) -> None:
    oktagon_event_id = find_event_id(number)
    if not oktagon_event_id:
        print(f"OKTAGON {number} nenalezen v API (možná je už mimo posledních ~20 eventů).")
        return

    fights = fetch_fightcard(oktagon_event_id)
    print(f"OKTAGON {number} (oktagon_event_id={oktagon_event_id}), {len(fights)} zápasů:\n")

    for fight in fights:
        a, b = fight["fighter_a"]["name"], fight["fighter_b"]["name"]
        print(f"=== {a} vs {b} (card_order={fight['card_order']}) ===")

        if fight["status"] == "scheduled":
            print("(zatím bez výsledku)\n")
            continue

        if fight["status"] == "no_contest":
            print("Push: Zápas skončil bez výsledku (remíza/no contest), tvůj tip se nezapočítává.\n")
            continue

        winner = a if fight["winner_side"] == "a" else b
        desc = _result_description(fight["method"], fight["result_round"], fight["result_time"])
        print(f"Push title: {a} vs {b}")
        print(f"Push body:  Vyhrál {winner} ({desc}). Tvůj tip: <jméno> → <body> b.\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--number", type=int, required=True)
    args = parser.parse_args()
    main(args.number)
