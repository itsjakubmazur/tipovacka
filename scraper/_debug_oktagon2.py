import re

import requests
from sherdog import USER_AGENT

resp = requests.get("https://oktagonmma.com/cs/turnaje/", headers={"User-Agent": USER_AGENT}, timeout=30)
html = resp.text
print(f"turnaje list status={resp.status_code} len={len(html)}")

print("\n--- all /cs/ hrefs (sample, deduped) ---")
all_links = sorted(set(re.findall(r'href="(/cs/[^"]*)"', html, re.I)))
for href in all_links[:60]:
    print(href)

print("\n--- links containing turnaj/oktagon/galavecer/akce (sample) ---")
links = set(re.findall(r'href="(/cs/[^"]*(?:turnaj|oktagon|galavecer|akce)[^"]*)"', html, re.I))
for href in list(links)[:20]:
    print(href)

print("\n--- og:image on listing page ---")
for m in re.finditer(r'<meta[^>]+(?:og:image|twitter:image)[^>]*>', html, re.I):
    print(m.group())

# try to fetch one specific event detail page if we found a link
candidates = [h for h in links if re.search(r"\d", h)] or list(links)
if candidates:
    detail_url = "https://oktagonmma.com" + candidates[0]
    resp2 = requests.get(detail_url, headers={"User-Agent": USER_AGENT}, timeout=30)
    print(f"\n--- detail page {detail_url} status={resp2.status_code} len={len(resp2.text)} ---")
    for m in re.finditer(r'<meta[^>]+(?:og:image|twitter:image)[^>]*>', resp2.text, re.I):
        print(m.group())
    imgs = re.findall(r"<img[^>]*>", resp2.text)
    print(f"img tag count: {len(imgs)}")
    for tag in imgs[:15]:
        print(tag)
else:
    print("No candidate event links found")

print("\n--- __NEXT_DATA__ on turnaje listing page ---")
m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
if m:
    payload = m.group(1)
    print(f"found, length={len(payload)}")
    print(payload[:3000])
else:
    print("not found")

print("\n--- buildId / _next/data hints ---")
for m in re.finditer(r'/_next/(?:static|data)/([A-Za-z0-9_-]+)/', html):
    print(m.group(0))
    break

print("\n--- fantasy/play page: __NEXT_DATA__ ---")
resp3 = requests.get("https://oktagonmma.com/cs/fantasy/play/", headers={"User-Agent": USER_AGENT}, timeout=30)
html3 = resp3.text
print(f"fantasy play status={resp3.status_code} len={len(html3)}")
m3 = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html3, re.S)
if m3:
    payload3 = m3.group(1)
    print(f"found, length={len(payload3)}")

    print("\n--- dehydratedState queries summary ---")
    import json

    data = json.loads(payload3)
    queries = (
        data.get("props", {})
        .get("pageProps", {})
        .get("dehydratedState", {})
        .get("queries", [])
    )
    print(f"query count: {len(queries)}")
    for q in queries:
        key = q.get("queryKey")
        print(f"\nqueryKey: {key}")

    print("\n--- image-like URLs anywhere in payload ---")
    for m in re.finditer(r'https?://[^"\\]*\.(?:jpg|jpeg|png|webp)', payload3, re.I):
        print(m.group())
else:
    print("not found")
