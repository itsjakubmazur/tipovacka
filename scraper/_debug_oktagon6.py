import json

import requests
from sherdog import USER_AGENT


def slim_fighter(f: dict) -> dict:
    return {k: v for k, v in f.items() if k not in ("description",)}


def dump(event_id: int, label: str) -> None:
    resp = requests.get(
        f"https://api.oktagonmma.com/v1/events/{event_id}/fightcard",
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    data = resp.json()
    cards = data if isinstance(data, list) else data.get("fights", [])
    print(f"\n=== {label} (id={event_id}) cards={len(cards)} ===")
    for card in cards:
        for fight in card.get("fights", []):
            slim = {k: v for k, v in fight.items() if k not in ("fighter1", "fighter2")}
            slim["fighter1"] = slim_fighter(fight.get("fighter1", {}))
            slim["fighter2"] = slim_fighter(fight.get("fighter2", {}))
            slim["fighter1"].pop("rankings", None)
            slim["fighter1"].pop("otherRankings", None)
            slim["fighter2"].pop("rankings", None)
            slim["fighter2"].pop("otherRankings", None)
            print(json.dumps(slim, indent=2, ensure_ascii=False))
            print("---")


dump(131, "OKTAGON 89 (completed)")
