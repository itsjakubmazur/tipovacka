import re

import requests
from sherdog import USER_AGENT

resp = requests.get("https://oktagonmma.com/cs/fantasy/play/", headers={"User-Agent": USER_AGENT}, timeout=30)
html = resp.text
print(f"fantasy play status={resp.status_code} len={len(html)}")

script_srcs = sorted(set(re.findall(r'<script[^>]+src="([^"]+)"', html)))
chunk_srcs = [s for s in script_srcs if "_next/static/chunks" in s]
print(f"scanning {len(chunk_srcs)} chunk files for /v1/ endpoint literals...")

all_paths: dict[str, set[str]] = {}
for s in chunk_srcs:
    url = s if s.startswith("http") else f"https://oktagonmma.com{s}"
    try:
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    except requests.RequestException as exc:
        print(f"failed to fetch {url}: {exc}")
        continue
    paths = set(re.findall(r'["\'`](/v1/[a-zA-Z0-9/_-]+)["\'`]', r.text))
    # also catch template-literal style endpoints like `event` or `current-event`
    fantasy_hits = set(
        re.findall(r'["\'`]([a-zA-Z0-9/_-]*(?:fantasy|event|tournament)[a-zA-Z0-9/_-]*)["\'`]', r.text, re.I)
    )
    if paths or fantasy_hits:
        all_paths[s] = paths | {h for h in fantasy_hits if len(h) < 60}

print(f"\n--- chunks with hits ({len(all_paths)} / {len(chunk_srcs)}) ---")
for s, paths in all_paths.items():
    print(f"\n{s}")
    for p in sorted(paths)[:30]:
        print(f"  {p}")
