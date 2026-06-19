import re

import requests
from sherdog import USER_AGENT

bundle_url = (
    "https://oktagonmma.com/_next/static/chunks/pages/fantasy/play-043a9dc121458619.js"
    "?dpl=dpl_AvUP19atFpxQytqLpeDUY7JwJs9H"
)
resp = requests.get(bundle_url, headers={"User-Agent": USER_AGENT}, timeout=30)
js = resp.text
print(f"fetched fantasy/play bundle status={resp.status_code} len={len(js)}")

print("\n--- occurrences of 'api.oktagonmma.com' with surrounding context ---")
for m in re.finditer(r".{60}api\.oktagonmma\.com.{120}", js):
    print(m.group())
    print("---")

print("\n--- relative /v1/... path literals in this bundle ---")
paths = sorted(set(re.findall(r'["\'](/v1/[a-zA-Z0-9/_-]+)["\']', js)))
for p in paths[:60]:
    print(p)

print(f"\ntotal distinct /v1/ paths: {len(paths)}")
