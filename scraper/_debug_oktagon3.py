import json

import requests
from sherdog import USER_AGENT

for label, url in [
    ("OKTAGON 90 (upcoming, id 124)", "https://api.oktagonmma.com/v1/events/124/fightcard"),
    ("OKTAGON 89 (past, id 131)", "https://api.oktagonmma.com/v1/events/131/fightcard"),
]:
    print(f"\n=== {label} ===")
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    print(f"status={resp.status_code} len={len(resp.text)}")
    if resp.status_code != 200:
        print(resp.text[:1000])
        continue
    data = resp.json()
    print(f"top-level type: {type(data).__name__}")
    if isinstance(data, dict):
        print(f"top-level keys: {sorted(data.keys())}")
        items = data.get("data") if isinstance(data.get("data"), list) else [data]
    elif isinstance(data, list):
        items = data
    else:
        items = []
    print(f"item count: {len(items)}")
    if items:
        print("first item keys:", sorted(items[0].keys()) if isinstance(items[0], dict) else type(items[0]))
        print("first item compact JSON:")
        print(json.dumps(items[0], ensure_ascii=False))
