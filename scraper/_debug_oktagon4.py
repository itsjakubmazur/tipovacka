import json

import requests
from sherdog import USER_AGENT

resp = requests.get(
    "https://api.oktagonmma.com/v1/events/",
    headers={"User-Agent": USER_AGENT},
    timeout=30,
)
print(f"status={resp.status_code} len={len(resp.text)}")
data = resp.json()
print(f"top-level type: {type(data).__name__}")
items = data if isinstance(data, list) else data.get("data", data.get("items", []))
print(f"item count: {len(items)}")
if items:
    print("first item keys:", sorted(items[0].keys()))
    print("\nall events (id, state, slugs, startDate, shortTitle):")
    for ev in items:
        print(
            ev.get("id"),
            ev.get("state"),
            ev.get("slugs"),
            ev.get("startDate"),
            ev.get("shortTitle"),
        )
if isinstance(data, dict):
    print("\ntop-level dict keys (pagination?):", sorted(data.keys()))
