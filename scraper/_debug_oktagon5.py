import json

import requests
from sherdog import USER_AGENT


def dump(event_id: int, label: str) -> None:
    resp = requests.get(
        f"https://api.oktagonmma.com/v1/events/{event_id}/fightcard",
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    print(f"\n=== {label} (id={event_id}) status={resp.status_code} ===")
    data = resp.json()
    print("top-level keys:", sorted(data.keys()) if isinstance(data, dict) else type(data))
    fights = data.get("fights") if isinstance(data, dict) else data
    print(f"fight count: {len(fights)}")
    if not fights:
        return
    fight = fights[0]
    print("fight keys:", sorted(fight.keys()))
    print(json.dumps(fight, indent=2, ensure_ascii=False)[:6000])


dump(134, "OKTAGON 91 (upcoming)")
dump(131, "OKTAGON 89 (completed)")
