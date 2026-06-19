import json

import requests
from sherdog import USER_AGENT

resp = requests.get(
    "https://api.oktagonmma.com/v1/events/131/fightcard",
    headers={"User-Agent": USER_AGENT},
    timeout=30,
)
data = resp.json()

all_fights = []
for group in data:
    all_fights.extend(group.get("fights", []))

print(f"total fights: {len(all_fights)}")
for fight in all_fights:
    f1 = fight.get("fighter1", {})
    f2 = fight.get("fighter2", {})
    keys = sorted(fight.keys())
    print(f"\n--- {f1.get('lastName')} vs {f2.get('lastName')} | keys: {keys}")
    summary = {
        k: v
        for k, v in fight.items()
        if k not in ("fighter1", "fighter2", "description", "event", "weightClass")
    }
    print(json.dumps(summary, ensure_ascii=False))
