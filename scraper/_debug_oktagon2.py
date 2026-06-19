import json

import requests
from sherdog import USER_AGENT

url = "https://oktagonmma.com/_next/data/build-TfctsWXpff2fKS/cs.json"
resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
print(f"status={resp.status_code} len={len(resp.text)}")

data = resp.json()
queries = data["pageProps"]["dehydratedState"]["queries"]
print(f"query count: {len(queries)}")

event = queries[0]["state"]["data"][0]
print("\n--- top-level keys on the event object ---")
print(sorted(event.keys()))

print("\n--- full event object as compact JSON (this is the one we want) ---")
print(json.dumps(event, ensure_ascii=False))
