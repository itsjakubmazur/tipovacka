import re

import requests
from sherdog import USER_AGENT

resp = requests.get("https://oktagonmma.com/cs/fantasy/play/", headers={"User-Agent": USER_AGENT}, timeout=30)
html = resp.text
print(f"fantasy play status={resp.status_code} len={len(html)}")

script_srcs = sorted(set(re.findall(r'<script[^>]+src="([^"]+)"', html)))
print(f"\n--- {len(script_srcs)} script src tags ---")
for s in script_srcs:
    print(s)

candidates = [s for s in script_srcs if "_next/static/chunks" in s and ("main" in s or "app" in s or "pages" in s or "fantasy" in s)]
print(f"\n--- {len(candidates)} candidate app bundles to scan for API hosts ---")
for s in candidates[:8]:
    print(s)

api_pattern = re.compile(r'https?://[a-zA-Z0-9.-]*(?:api|backend|gateway)[a-zA-Z0-9.-]*\.[a-zA-Z]{2,}[^\s"\'\\]*')
found_apis: set[str] = set()
for s in candidates[:8]:
    url = s if s.startswith("http") else f"https://oktagonmma.com{s}"
    try:
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    except requests.RequestException as exc:
        print(f"failed to fetch {url}: {exc}")
        continue
    print(f"fetched {url} status={r.status_code} len={len(r.text)}")
    for m in api_pattern.finditer(r.text):
        found_apis.add(m.group())

print(f"\n--- {len(found_apis)} candidate API URLs found across bundles ---")
for u in sorted(found_apis)[:40]:
    print(u)
